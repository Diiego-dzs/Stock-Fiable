const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const claveAnterior = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'clave-exclusiva-pruebas-matriz-roles';

let cuentas, lotes, eventos, snapshot;
function reset() {
  cuentas = [
    { id: 1, nombre: 'Dueño de prueba', rol: 'Dueño', activo: 1 },
    { id: 2, nombre: 'Empleado de prueba', rol: 'Empleado', activo: 1 },
    { id: 3, nombre: 'Consulta de prueba', rol: 'Consulta', activo: 1 }
  ];
  lotes = [{ id: 1, producto_id: 1, stock_actual: 10, estado: 'activo', codigo_lote: 'A' }];
  eventos = [];
}
async function query(sql, params = []) {
  eventos.push({ sql, params });
  if (sql.includes('FROM usuarios WHERE id')) return cuentas.filter(u => u.id === params[0]);
  if (sql.includes('FROM usuarios')) return cuentas;
  if (sql.includes('COUNT(*) AS total_productos')) return [{ total_productos: 1, unidades_totales: 10, productos_sin_stock: 0, productos_stock_bajo: 0, productos_stock_normal: 1 }];
  if (sql.includes('COUNT(*) AS total')) return [{ total: 0 }];
  if (sql.includes('FROM productos') && sql.includes('WHERE id = ?')) return [{ id: 1, nombre: 'Producto' }];
  if (sql.includes('FROM lotes') && sql.includes('FOR UPDATE')) return lotes.filter(l => l.estado === 'activo' && (sql.includes('WHERE id = ?') ? l.id === params[0] && l.producto_id === params[1] : l.producto_id === params[0] && l.stock_actual > 0));
  if (sql.includes('INSERT INTO lotes')) {
    const id = lotes.length + 1;
    lotes.push({ id, producto_id: params[0], stock_actual: 0, codigo_lote: params[1], estado: 'activo' });
    return { insertId: BigInt(id) };
  }
  if (sql.includes('INSERT INTO movimientos')) return { insertId: 100n };
  if (sql.includes('UPDATE lotes')) {
    const lote = lotes.find(l => l.id === params[1]);
    lote.stock_actual += sql.includes('stock_actual -') ? -Number(params[0]) : Number(params[0]);
    return { affectedRows: 1 };
  }
  if (sql.trim().startsWith('SELECT')) return [];
  throw new Error('Consulta no prevista en las pruebas');
}
require.cache[require.resolve('../src/config/db')] = { exports: { query, getConnection: async () => ({
  query,
  async beginTransaction() { eventos.push('begin'); snapshot = structuredClone(lotes); },
  async commit() { eventos.push('commit'); },
  async rollback() { eventos.push('rollback'); lotes = snapshot; },
  release() {}
}) } };

test('matriz de permisos por HTTP con MariaDB simulada', async t => {
  const app = express(); app.use(express.json());
  for (const modulo of ['productos', 'movimientos', 'stock', 'categorias', 'usuarios']) app.use(`/api/${modulo}`, require(`../src/routes/${modulo}.routes`));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const tokens = new Map([1, 2, 3].map(id => [id, jwt.sign({ id, rol: 'Dueño' }, process.env.JWT_SECRET)]));
  async function llamar(id, ruta, body, method = 'POST') {
    const respuesta = await fetch(base + ruta, {
      method: body === undefined ? 'GET' : method,
      headers: { Authorization: `Bearer ${tokens.get(id)}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: respuesta.status, body: await respuesta.json() };
  }
  const entrada = { producto_id: 1, lote_id: 1, cantidad: 2, motivo: 'Reposición' };
  await t.test('los tres roles consultan productos, inventario, historial, alertas y reportes', async () => {
    reset();
    for (const id of [1, 2, 3]) for (const ruta of ['/productos', '/productos/1/stock', '/productos/1/lotes', '/productos/1/movimientos', '/stock', '/stock/resumen', '/stock/alertas', '/stock/vencimientos', '/stock/alertas-vencimiento', '/categorias', '/movimientos', '/movimientos?exportar=1']) assert.equal((await llamar(id, ruta)).status, 200, `${id} ${ruta}`);
  });
  await t.test('solo Dueño administra usuarios y catálogo fijo', async () => {
    reset();
    assert.equal((await llamar(1, '/usuarios')).status, 200);
    assert.deepEqual((await llamar(1, '/usuarios/roles')).body, ['Dueño', 'Empleado', 'Consulta']);
    for (const id of [2, 3]) {
      assert.equal((await llamar(id, '/usuarios')).status, 403);
      assert.equal((await llamar(id, '/usuarios/roles')).status, 403);
      assert.equal((await llamar(id, '/usuarios', {})).status, 403);
      assert.equal((await llamar(id, '/usuarios/1', {}, 'PUT')).status, 403);
    }
  });
  await t.test('Empleado y Consulta no pueden crear productos ni lotes independientes', async () => {
    reset();
    for (const id of [2, 3]) for (const ruta of ['/productos', '/productos/1/lotes']) assert.equal((await llamar(id, ruta, {})).status, 403);
    assert.ok(!eventos.some(e => e.sql?.includes('INSERT')));
    // Owner passes authorization, then receives validation errors for the empty payload.
    assert.equal((await llamar(1, '/productos', {})).status, 400);
  });
  await t.test('Dueño y Empleado registran entradas y salidas con responsable', async () => {
    for (const id of [1, 2]) {
      reset();
      assert.equal((await llamar(id, '/movimientos/entrada', entrada)).status, 201);
      assert.equal(lotes[0].stock_actual, 12);
      assert.equal((await llamar(id, '/movimientos/salida', { producto_id: 1, cantidad: 3, motivo: 'Venta' })).status, 201);
      assert.equal(lotes[0].stock_actual, 9);
      const registros = eventos.filter(e => e.sql?.includes('INSERT INTO movimientos_stock'));
      assert.ok(registros.every(e => e.params[1] === id));
    }
  });
  await t.test('Empleado crea lote con entrada en una única transacción', async () => {
    reset();
    const resultado = await llamar(2, '/movimientos/entrada', { producto_id: 1, cantidad: 4, motivo: 'Compra', nuevo_lote: { codigo_lote: 'NUEVO', fecha_vencimiento: '2027-01-01' } });
    assert.equal(resultado.status, 201);
    assert.equal(lotes[1].stock_actual, 4);
    assert.equal(eventos.filter(e => e === 'begin').length, 1);
    assert.equal(eventos.filter(e => e === 'commit').length, 1);
    assert.ok(eventos.findIndex(e => e.sql?.includes('INSERT INTO lotes')) > eventos.indexOf('begin'));
  });
  await t.test('Consulta no escribe ni crea lotes mediante entradas', async () => {
    reset();
    for (const body of [entrada, { producto_id: 1, cantidad: 1, motivo: 'Compra', nuevo_lote: {} }]) assert.equal((await llamar(3, '/movimientos/entrada', body)).status, 403);
    assert.equal((await llamar(3, '/movimientos/salida', { producto_id: 1, cantidad: 1, motivo: 'Venta' })).status, 403);
    assert.ok(!eventos.includes('begin'));
    assert.equal(lotes[0].stock_actual, 10);
  });
  await t.test('un token existente aplica el rol vigente, incluida promoción y degradación', async () => {
    reset();
    assert.equal((await llamar(2, '/movimientos/entrada', entrada)).status, 201);
    cuentas[1].rol = 'Consulta';
    assert.equal((await llamar(2, '/movimientos/entrada', entrada)).status, 403);
    cuentas[1].rol = 'Dueño';
    assert.equal((await llamar(2, '/usuarios')).status, 200);
    cuentas[1].activo = 0;
    assert.equal((await llamar(2, '/productos')).status, 401);
  });
});
test('interfaz comparte el permiso de movimientos para Dueño y Empleado', async () => {
  const { puedeRegistrarMovimientos } = await import('../frontend/src/permisos.js');
  assert.equal(puedeRegistrarMovimientos('Dueño'), true);
  assert.equal(puedeRegistrarMovimientos('Empleado'), true);
  assert.equal(puedeRegistrarMovimientos('Consulta'), false);
  assert.equal(puedeRegistrarMovimientos('Desconocido'), false);
});
test.after(() => { if (claveAnterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = claveAnterior; });
