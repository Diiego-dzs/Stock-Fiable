const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');
let productos, lotes, movimientos, consultas, instantanea, unicoConcurrente;
const original = { id: 1, codigo: 'P-001', nombre: 'Producto original', descripcion: 'Descripción original', categoria_id: 1, stock_minimo: 3, marca: 'Marca', precio_compra: 10, precio_venta: 20, estado: 'activo', fecha_actualizacion: '2026-01-01' };
function reset() {
  productos = [structuredClone(original), { ...original, id: 2, codigo: 'P-002' }];
  lotes = [{ id: 1, producto_id: 1, stock_actual: 7, estado: 'activo', fecha_vencimiento: '2027-01-01' }];
  movimientos = [{ id: 1, producto_id: 1, cantidad: 7, tipo: 'ENTRADA' }];
  consultas = []; unicoConcurrente = false;
}
async function query(sql, params = []) {
  const q = sql.replace(/\s+/g, ' ').trim(); consultas.push({ sql: q, params });
  if (q.includes('FROM usuarios WHERE id')) return [{ id: params[0], nombre: 'Cuenta de prueba', rol: ['Dueño', 'Empleado', 'Consulta'][params[0] - 1], activo: 1 }];
  if (q.startsWith('SELECT id FROM productos WHERE id')) return productos.filter(p => p.id === params[0]).map(p => ({ id: p.id }));
  if (q.startsWith('SELECT id FROM productos WHERE codigo')) return productos.filter(p => p.codigo === params[0] && p.id !== params[1]).map(p => ({ id: p.id }));
  if (q.startsWith('SELECT id FROM categorias')) return [1, 2].includes(params[0]) ? [{ id: params[0] }] : [];
  if (q.startsWith('UPDATE productos SET')) {
    if (unicoConcurrente) throw Object.assign(new Error('duplicate'), { errno: 1062 });
    const producto = productos.find(p => p.id === params.at(-1));
    const campos = q.split(' SET ')[1].split(', fecha_actualizacion')[0].split(', ').map(s => s.split(' = ')[0]);
    campos.forEach((campo, i) => { producto[campo] = params[i]; });
    producto.fecha_actualizacion = '2026-11-07';
    return { affectedRows: 1 };
  }
  if (q.startsWith('SELECT p.*, c.nombre')) return productos.filter(p => p.id === params[0]).map(p => ({ ...p, categoria: 'Categoría ' + p.categoria_id, stock_actual: lotes.filter(l => l.producto_id === p.id && l.estado === 'activo').reduce((total, l) => total + l.stock_actual, 0) }));
  if (q.startsWith('INSERT INTO productos')) {
    if (productos.some(p => p.codigo === params[0])) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
    const id = 3;
    productos.push({ id, codigo: params[0], nombre: params[1], descripcion: params[2], marca: params[3], categoria_id: params[4], precio_compra: params[5], precio_venta: params[6], stock_minimo: params[7], estado: 'activo' });
    return { insertId: BigInt(id) };
  }
  throw new Error('Operación inesperada en las pruebas');
}
require.cache[require.resolve('../src/config/db')] = { exports: { query, getConnection: async () => ({ query,
  async beginTransaction() { instantanea = structuredClone(productos); }, async commit() {},
  async rollback() { productos = instantanea; }, release() {}
}) } };

test('edición de productos mediante HTTP sin MariaDB real', async t => {
  const anterior = process.env.JWT_SECRET; process.env.JWT_SECRET = 'secreto-exclusivo-pruebas-edicion';
  const app = express(); app.use(express.json()); app.use('/api/productos', require('../src/routes/productos.routes'));
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
  async function enviar(datos, { id = 1, rol = 1, metodo = 'PATCH' } = {}) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/productos${metodo === 'POST' ? '' : '/' + id}`, { method: metodo,
      headers: { 'Content-Type': 'application/json', ...(rol ? { Authorization: 'Bearer ' + jwt.sign({ id: rol }, process.env.JWT_SECRET) } : {}) }, body: JSON.stringify(datos) });
    return { status: res.status, body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : { error: await res.text() } };
  }
  await t.test('edita los cinco campos y conserva stock, lotes, movimientos y campos protegidos', async () => {
    reset(); const datosInventario = structuredClone({ lotes, movimientos });
    const res = await enviar({ nombre: ' Nuevo nombre ', descripcion: 'Texto\nmultilínea', categoria_id: 2, codigo: 'NUEVO', stock_minimo: 8 });
    assert.equal(res.status, 200);
    const p = res.body.producto;
    assert.equal(p.nombre, 'Nuevo nombre'); assert.equal(p.descripcion, 'Texto\nmultilínea'); assert.equal(p.categoria_id, 2); assert.equal(p.codigo, 'NUEVO'); assert.equal(p.stock_minimo, 8);
    assert.equal(p.stock_actual, 7); assert.equal(p.id, 1); assert.equal(p.marca, original.marca); assert.equal(p.precio_venta, original.precio_venta); assert.equal(p.estado, original.estado);
    assert.notEqual(p.fecha_actualizacion, original.fecha_actualizacion);
    assert.deepEqual({ lotes, movimientos }, datosInventario);
  });
  await t.test('PATCH parcial preserva campos omitidos y permite vaciar descripción', async () => {
    reset(); assert.equal((await enviar({ nombre: 'Solo nombre' })).status, 200);
    assert.deepEqual(productos[0], { ...original, nombre: 'Solo nombre', fecha_actualizacion: '2026-11-07' });
    assert.equal((await enviar({ descripcion: null })).status, 200); assert.equal(productos[0].descripcion, null);
  });
  await t.test('código propio permitido, duplicado rechazado y UNIQUE concurrente devuelve 409', async () => {
    reset(); assert.equal((await enviar({ codigo: original.codigo })).status, 200);
    assert.equal((await enviar({ codigo: 'P-002', nombre: 'No guardar' })).status, 409);
    assert.equal(productos[0].nombre, original.nombre);
    unicoConcurrente = true; assert.equal((await enviar({ codigo: 'OTRO' })).status, 409);
    assert.equal(productos[0].codigo, original.codigo);
  });
  await t.test('categoría inexistente y producto inexistente', async () => {
    reset(); assert.equal((await enviar({ categoria_id: 99 })).status, 400);
    assert.equal((await enviar({ nombre: 'No existe' }, { id: 99 })).status, 404);
    assert.deepEqual(productos[0], original);
  });
  await t.test('rechaza datos inválidos y PATCH vacío', async () => {
    reset();
    for (const datos of [{}, [], null, { nombre: ' ' }, { nombre: 4 }, { nombre: 'x'.repeat(151) }, { codigo: '' }, { codigo: 'x'.repeat(51) }, { descripcion: {} }, { descripcion: 'x'.repeat(16001) }, { categoria_id: true }, { categoria_id: 0 }, { categoria_id: 'no' }, { stock_minimo: null }, { stock_minimo: -1 }, { stock_minimo: true }, { stock_minimo: 'NaN' }, { stock_minimo: '0.001' }, { stock_minimo: 100000000 }]) assert.equal((await enviar(datos)).status, 400, JSON.stringify(datos).slice(0, 100));
    assert.equal((await enviar({ nombre: 'X' }, { id: 'invalido' })).status, 400);
    assert.deepEqual(productos[0], original);
  });
  await t.test('rechaza todos los campos prohibidos incluso combinados con campos válidos', async () => {
    reset();
    for (const campo of ['stock_actual', 'lotes', 'movimientos', 'estado', 'precio_compra', 'precio_venta', 'marca', 'id', 'producto_id', 'fecha_creacion', 'fecha_actualizacion', 'desconocido', '__proto__']) {
      const res = await enviar(Object.fromEntries([['nombre', 'No guardar'], [campo, 5]])); assert.equal(res.status, 400, campo);
    }
    assert.deepEqual(productos[0], original);
  });
  await t.test('solo Dueño edita; Empleado y Consulta no escriben; JWT requerido', async () => {
    reset();
    assert.equal((await enviar({ nombre: 'X' }, { rol: 0 })).status, 401);
    for (const rol of [2, 3]) assert.equal((await enviar({ nombre: 'X' }, { rol })).status, 403);
    assert.deepEqual(productos[0], original);
    assert.equal((await enviar({ nombre: 'Dueño' })).status, 200);
  });
  await t.test('alta conserva normalización, opcionales, decimales y rechazo de duplicados', async () => {
    reset();
    const datos = { codigo: ' ALTA ', nombre: ' Producto ', categoria_id: 1, precio_compra: '2.50', stock_minimo: '1.25' };
    const res = await enviar(datos, { metodo: 'POST' });
    assert.equal(res.status, 201); assert.equal(res.body.producto.stock_actual, 0);
    assert.deepEqual(productos.at(-1), { id: 3, codigo: 'ALTA', nombre: 'Producto', descripcion: null, marca: null, categoria_id: 1, precio_compra: 2.5, precio_venta: 0, stock_minimo: 1.25, estado: 'activo' });
    assert.equal((await enviar(datos, { metodo: 'POST' })).status, 409);
    assert.equal((await enviar({ ...datos, codigo: 'NEG', precio_compra: -1 }, { metodo: 'POST' })).status, 400);
  });
});

test('formulario precarga solo campos editables y genera PATCH parcial', async () => {
  const { valoresEdicionProducto, cambiosProducto } = await import('../frontend/src/productos.utils.js');
  const valores = valoresEdicionProducto({ ...original, stock_minimo: '3.00', stock_actual: 7 });
  assert.equal(valores.stock_minimo, '3'); assert.equal(valores.categoria_id, '1');
  assert.ok(!Object.hasOwn(valores, 'stock_actual')); assert.ok(!Object.hasOwn(valores, 'precio_venta'));
  assert.deepEqual(cambiosProducto({ ...valores, nombre: 'Nuevo' }, valores), { nombre: 'Nuevo' });
  assert.deepEqual(cambiosProducto({ ...valores }, valores), {});
});
