const { test } = require('node:test');
const assert = require('node:assert/strict');
// Replace the pool before importing services: no .env read and no database connection.
const calls = [];
let failUpdate = false;
const connection = {
  async beginTransaction() { calls.push('begin'); },
  async commit() { calls.push('commit'); },
  async rollback() { calls.push('rollback'); },
  release() { calls.push('release'); },
  async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('UPDATE lotes') && failUpdate) throw new Error('simulated update failure');
    if (sql.includes('INSERT')) return { insertId: 42n };
    if (sql.includes("AND stock_actual > 0")) return [{ id: 1, stock_actual: 3 }, { id: 2, stock_actual: 4 }];
    return [{ id: 42, stock_actual: 0, estado: 'activo' }];
  }
};
require.cache[require.resolve('../src/config/db')] = { exports: { getConnection: async () => connection } };
const products = require('../src/services/productos.service');
const lots = require('../src/services/lotes.service');
const movements = require('../src/services/movimientos.service');
const entry = { producto_id: 1, usuario_id: 7, cantidad: 5, motivo: 'Compra' };

test('inventory flows without MariaDB', async t => {
  await t.test('product creation and validation', async () => {
    const result = await products.crearProducto({ codigo: 'A', nombre: 'Producto', categoria_id: 1 });
    assert.equal(result.stock_actual, 0);
    await assert.rejects(products.crearProducto({ codigo: '', nombre: 'A', categoria_id: 1 }));
    await assert.rejects(products.crearProducto({ codigo: 'A', nombre: 'A', categoria_id: 1, precio_compra: -1 }));
  });
  await t.test('lot date and zero stock', async () => {
    assert.throws(() => lots.validarLote({ fecha_vencimiento: '2026-02-30' }));
    calls.length = 0;
    assert.equal((await lots.crearLote(1, {})).stock_actual, 0);
    assert.ok(calls.includes('commit'));
  });
  await t.test('new lot and entry share one transaction', async () => {
    calls.length = 0;
    const result = await movements.registrarEntrada({ ...entry, nuevo_lote: {} });
    assert.equal(result.lote_id, 42);
    assert.equal(calls.filter(x => x === 'begin').length, 1);
    assert.equal(calls.filter(x => x === 'commit').length, 1);
    assert.ok(calls.find(x => x.sql?.includes('INSERT INTO lotes')));
    assert.ok(calls.find(x => x.sql?.includes('INSERT INTO movimientos_lotes')));
  });
  await t.test('existing lot locked and active, without creating lot', async () => {
    calls.length = 0;
    await movements.registrarEntrada({ ...entry, lote_id: 42 });
    assert.ok(calls.find(x => x.sql?.includes('FOR UPDATE') && x.sql.includes("estado = 'activo'")));
    assert.ok(!calls.find(x => x.sql?.includes('INSERT INTO lotes')));
  });
  await t.test('failure rolls back new lot and movement', async () => {
    calls.length = 0; failUpdate = true;
    await assert.rejects(movements.registrarEntrada({ ...entry, nuevo_lote: {} }), /simulated/);
    failUpdate = false;
    assert.ok(calls.includes('rollback'));
    assert.ok(!calls.includes('commit'));
    assert.equal(calls.at(-1), 'release');
  });
  await t.test('ambiguous or invalid entries rejected before connecting', async () => {
    calls.length = 0;
    await assert.rejects(movements.registrarEntrada({ ...entry, lote_id: 1, nuevo_lote: {} }));
    await assert.rejects(movements.registrarEntrada({ ...entry, lote_id: 1, cantidad: Infinity }));
    assert.equal(calls.length, 0);
  });
  await t.test('FEFO still splits across lots and locks rows', async () => {
    calls.length = 0;
    const result = await movements.registrarSalida(entry);
    assert.deepEqual(result.lotes.map(l => l.cantidad), [3, 2]);
    assert.ok(calls.find(x => x.sql?.includes('fecha_vencimiento ASC') && x.sql.includes('FOR UPDATE')));
  });
  await t.test('owner permission rejects other roles', () => {
    const { permitirRoles } = require('../src/middleware/rol.middleware');
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    permitirRoles('Dueño')({ usuario: { rol: 'Empleado' } }, res, () => assert.fail('unauthorized'));
    assert.equal(status, 403);
    let allowed = false;
    permitirRoles('Dueño')({ usuario: { rol: 'Dueño' } }, res, () => { allowed = true; });
    assert.ok(allowed);
  });
});

test('creation routes enforce owner role and controller accepts new lot', async () => {
  const router = require('../src/routes/productos.routes');
  const routes = router.stack.filter(layer => layer.route?.methods.post);
  assert.equal(routes.length, 2);
  for (const layer of routes) {
    let status, allowed = false;
    const res = { status(code) { status = code; return this; }, json() {} };
    layer.route.stack[0].handle({ usuario: { rol: 'Empleado' } }, res, () => assert.fail('unauthorized'));
    assert.equal(status, 403);
    layer.route.stack[0].handle({ usuario: { rol: 'Due\u00f1o' } }, res, () => { allowed = true; });
    assert.ok(allowed);
  }
  let status, body;
  const res = { status(code) { status = code; return this; }, json(data) { body = data; } };
  await require('../src/controllers/movimientos.controller').registrarEntrada({ body: { ...entry, nuevo_lote: {} }, usuario: { id: 7 } }, res);
  assert.equal(status, 201);
  assert.equal(body.movimiento.lote_id, 42);
});
