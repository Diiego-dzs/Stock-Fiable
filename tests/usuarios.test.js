const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Only in-memory fixtures. The DB module is replaced before loading services or middleware.
let filas, consultas, transaccion, commits, rollbacks;
const secretoAnterior = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'clave-aislada-para-pruebas-de-usuarios';
const publico = u => { const { contrasena, ...datos } = u; return datos; };
async function query(sql, params = []) {
  consultas.push({ sql, params });
  if (sql.startsWith('SELECT DISTINCT')) return [...new Set(filas.map(u => u.rol))].map(rol => ({ rol }));
  if (sql.includes('WHERE email = ?')) return filas.filter(u => u.email === params[0]);
  if (sql.startsWith('SELECT') && sql.includes('WHERE id = ?')) return filas.filter(u => u.id === params[0]).map(publico);
  if (sql.startsWith('SELECT')) return filas.map(publico);
  if (sql.startsWith('INSERT')) {
    if (filas.some(u => u.email === params[1])) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
    const id = Math.max(...filas.map(u => u.id)) + 1;
    filas.push({ id, nombre: params[0], email: params[1], contrasena: params[2], rol: params[3], activo: params[4] });
    return { insertId: BigInt(id) };
  }
  if (sql.startsWith('UPDATE')) {
    if (filas.some(u => u.email === params[1] && u.id !== params[4])) throw Object.assign(new Error('duplicate'), { errno: 1062 });
    Object.assign(filas.find(u => u.id === params[4]), { nombre: params[0], email: params[1], rol: params[2], activo: params[3] });
    return { affectedRows: 1 };
  }
  throw new Error('Unexpected query');
}
require.cache[require.resolve('../src/config/db')] = { exports: { query, getConnection: async () => ({
  query,
  async beginTransaction() { transaccion = structuredClone(filas); },
  async commit() { commits++; },
  async rollback() { rollbacks++; filas = transaccion; },
  release() {}
}) } };
const service = require('../src/services/usuarios.service');
const { autenticar } = require('../src/middleware/auth.middleware');
const { permitirRoles } = require('../src/middleware/rol.middleware');
const datos = { nombre: 'Cuenta', email: 'cuenta@example.test', rol: 'Dueño', activo: true, contrasena: 'Prueba-segura-123' };
function response() { return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
async function autenticarCon(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }, res = response();
  let paso = false;
  await autenticar(req, res, () => { paso = true; });
  return { req, res, paso };
}

test('administración y autenticación de usuarios sin MariaDB real', async t => {
  const hash = await bcrypt.hash('Password-prueba-123', 4);
  async function reset() {
    filas = [
      { id: 1, nombre: 'Dueño Uno', email: 'uno@example.test', rol: 'Dueño', activo: 1, contrasena: hash },
      { id: 2, nombre: 'Dueño Dos', email: 'dos@example.test', rol: 'Dueño', activo: 1, contrasena: hash },
      { id: 3, nombre: 'Cuenta de pruebas', email: 'tres@example.test', rol: 'Empleado', activo: 1, contrasena: hash }
    ];
    consultas = []; commits = 0; rollbacks = 0;
  }
  await t.test('validación de campos, contraseñas y roles sin inventar permisos', async () => {
    await reset();
    for (const cambio of [{ nombre: '' }, { email: 'incorrecto' }, { rol: '' }, { activo: '1' }, { contrasena: 'corta' }, { contrasena: 'á'.repeat(40) }]) assert.throws(() => service.validarUsuario({ ...datos, ...cambio }, true));
    await assert.rejects(service.guardarUsuario(1, null, { ...datos, rol: 'Rol inexistente' }), /no existe/);
    assert.deepEqual(await service.obtenerRoles(), ['Dueño', 'Empleado', 'Consulta']);
  });
  await t.test('creación con bcrypt, normalización y respuestas sin hashes', async () => {
    await reset();
    const u = await service.guardarUsuario(1, null, { ...datos, email: ' NUEVO@example.test ' });
    assert.equal(u.email, 'nuevo@example.test');
    assert.ok(!Object.hasOwn(u, 'contrasena'));
    assert.ok(await bcrypt.compare(datos.contrasena, filas.find(f => f.id === u.id).contrasena));
    assert.equal(commits, 1);
    assert.ok(consultas.some(q => /ORDER BY id FOR UPDATE/.test(q.sql)));
    assert.ok((await service.listarUsuarios()).every(u => !Object.hasOwn(u, 'contrasena')));
  });
  await t.test('creación de Empleado y Consulta sin cuentas previas de esos roles', async () => {
    await reset();
    filas = filas.filter(u => u.rol === 'Dueño');
    for (const rol of ['Empleado', 'Consulta']) {
      const creado = await service.guardarUsuario(1, null, { ...datos, rol, email: `${rol.toLowerCase()}@example.test` });
      assert.equal(creado.rol, rol);
      assert.equal(creado.activo, 1);
      assert.ok(!Object.hasOwn(creado, 'contrasena'));
    }
    filas.push({ id: 99, rol: 'Legado', activo: 1 });
    assert.deepEqual(await service.obtenerRoles(), ['Dueño', 'Empleado', 'Consulta']);
    await assert.rejects(service.guardarUsuario(1, 99, { ...datos, rol: 'Legado' }), /no existe/);
    assert.equal(filas.find(u => u.id === 99).rol, 'Legado');
  });
  await t.test('duplicados en creación y edición hacen rollback', async () => {
    await reset();
    await assert.rejects(service.guardarUsuario(1, null, { ...datos, email: filas[0].email }), e => e.status === 409);
    await assert.rejects(service.guardarUsuario(1, 2, { ...datos, email: filas[0].email }), e => e.status === 409);
    assert.equal(rollbacks, 2); assert.equal(commits, 0);
  });
  await t.test('edición, activación y desactivación preservan contraseñas y responsables', async () => {
    await reset();
    await service.guardarUsuario(1, 2, { ...datos, activo: false });
    assert.equal(filas[1].activo, 0); assert.equal(filas[1].contrasena, hash);
    await service.guardarUsuario(1, 2, { ...datos, activo: true });
    assert.equal(filas[1].activo, 1);
    assert.ok(!consultas.some(q => q.sql.includes('DELETE')));
  });
  await t.test('autoprotección, último Dueño y actor desactivado concurrentemente', async () => {
    await reset();
    await assert.rejects(service.guardarUsuario(1, 1, { ...datos, activo: false }), /tu cuenta/);
    await assert.rejects(service.guardarUsuario(1, 1, { ...datos, rol: filas[2].rol }), /acceso administrativo/);
    filas[1].activo = 0;
    await assert.rejects(service.guardarUsuario(1, 1, { ...datos, activo: false }), /tu cuenta/);
    await assert.rejects(service.guardarUsuario(2, 1, { ...datos, activo: false }), e => e.status === 403);
    assert.equal(filas.filter(u => u.activo && u.rol === 'Dueño').length, 1);
  });
  await t.test('búsqueda y filtros usan parámetros y columnas públicas', async () => {
    await reset();
    await service.listarUsuarios({ busqueda: 'a%_', rol: 'Dueño', activo: '1' });
    const consulta = consultas.at(-1);
    assert.ok(!consulta.sql.includes('contrasena'));
    assert.deepEqual(consulta.params, ['%a=%=_%', '%a=%=_%', 'Dueño', 1]);
    await assert.rejects(service.listarUsuarios({ activo: 'true' }));
  });
  await t.test('tokens válidos, inválidos, expirados y cuentas inexistentes', async () => {
    await reset();
    assert.equal((await autenticarCon()).res.code, 401);
    assert.equal((await autenticarCon('invalido')).res.code, 401);
    assert.equal((await autenticarCon(jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -1 }))).res.code, 401);
    assert.equal((await autenticarCon(jwt.sign({ id: 99 }, process.env.JWT_SECRET))).res.code, 401);
    const resultado = await autenticarCon(jwt.sign({ id: 1, rol: 'obsoleto' }, process.env.JWT_SECRET));
    assert.ok(resultado.paso); assert.equal(resultado.req.usuario.rol, 'Dueño');
    assert.ok(!Object.hasOwn(resultado.req.usuario, 'contrasena'));
  });
  await t.test('desactivados no pueden iniciar sesión ni usar tokens existentes; roles vigentes', async () => {
    await reset();
    const auth = require('../src/services/auth.service');
    const login = await auth.login('uno@example.test', 'Password-prueba-123');
    assert.ok(login.token); assert.ok(!Object.hasOwn(login.usuario, 'contrasena'));
    filas[0].activo = 0;
    await assert.rejects(auth.login('uno@example.test', 'Password-prueba-123'), /inactivo/);
    assert.equal((await autenticarCon(login.token)).res.code, 401);
    filas[0].activo = 1; filas[0].rol = 'Empleado';
    const resultado = await autenticarCon(login.token);
    const res = response();
    permitirRoles('Dueño')(resultado.req, res, () => assert.fail('rol obsoleto no debe autorizar'));
    assert.equal(res.code, 403);
  });
  await t.test('todas las rutas de usuarios están protegidas en backend', async () => {
    await reset();
    const router = require('../src/routes/usuarios.routes');
    assert.equal(router.stack[0].handle, autenticar);
    const res = response();
    router.stack[1].handle({ usuario: filas[2] }, res, () => assert.fail('sin permisos'));
    assert.equal(res.code, 403);
    await assert.rejects(service.guardarUsuario(3, 2, datos), e => e.status === 403);
  });
  await t.test('fallo al verificar la cuenta rechaza la petición sin conceder acceso', async () => {
    await reset();
    const pool = require('../src/config/db');
    const anterior = pool.query;
    pool.query = async () => { throw new Error('No disponible'); };
    try {
      const resultado = await autenticarCon(jwt.sign({ id: 1, rol: 'Dueño' }, process.env.JWT_SECRET));
      assert.equal(resultado.res.code, 503); assert.equal(resultado.paso, false);
    } finally { pool.query = anterior; }
  });
  await t.test('login valida tipos antes de consultar y no acepta contraseña incorrecta', async () => {
    await reset();
    const controller = require('../src/controllers/auth.controller');
    const res = response();
    await controller.login({ body: { email: [], contrasena: {} } }, res);
    assert.equal(res.code, 400); assert.equal(consultas.length, 0);
    await assert.rejects(require('../src/services/auth.service').login('uno@example.test', 'incorrecta'), /Credenciales/);
  });
  await t.test('responsable se incorpora a consultas y reportes, con compatibilidad histórica', async () => {
    const { matrizReporte } = await import('../frontend/src/reportes.utils.js');
    const matriz = matrizReporte('movimientos', [{ fecha: '2026-11-02', cantidad: 1, usuario_responsable: 'Dueño Uno' }, { fecha: '2026-11-02', cantidad: 1 }]);
    assert.equal(matriz[0].at(-1), 'Responsable');
    assert.equal(matriz[1].at(-1), 'Dueño Uno');
    assert.equal(matriz[2].at(-1), 'Sin responsable registrado');
  });
});
test.after(() => { if (secretoAnterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretoAnterior; });
