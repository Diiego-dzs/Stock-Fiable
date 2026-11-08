const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');
let producto, eventos, snapshot;
const lotes = [{ id: 1, stock_actual: 3 }, { id: 2, stock_actual: 4 }];
const historial = [{ id: 8, cantidad: 7 }];
function reset() { producto = { id: 1, nombre: 'Prueba', estado: 'activo', stock_actual: 7 }; eventos = []; }
async function query(sql, params = []) {
 const q = sql.replace(/\s+/g, ' ').trim(); eventos.push({ sql: q, params });
 if (q.includes('FROM usuarios WHERE id')) return [{ id: params[0], rol: ['Dueño','Empleado','Consulta'][params[0]-1], activo: 1 }];
 if (q.startsWith('SELECT id, estado FROM productos')) return params[0] === 1 ? [{ ...producto }] : [];
 if (q.startsWith('UPDATE productos SET estado')) { producto.estado = params[0]; producto.fecha_actualizacion = 'actualizada'; return {}; }
 if (q.startsWith('SELECT p.*')) return [{ ...producto }];
 if (q.includes('FROM lotes') && q.includes('FOR UPDATE')) return lotes;
 if (q.includes('INSERT INTO')) return { insertId: 12n };
 if (q.startsWith('UPDATE lotes')) return {};
 throw Error('Consulta inesperada: ' + q);
}
require.cache[require.resolve('../src/config/db')] = { exports: { query, getConnection: async () => ({ query,
 async beginTransaction() { eventos.push('begin'); snapshot = structuredClone(producto); },
 async commit() { eventos.push('commit'); }, async rollback() { producto = snapshot; eventos.push('rollback'); }, release() { eventos.push('release'); }
}) } };
const productos = require('../src/services/productos.service');
const movimientos = require('../src/services/movimientos.service');
const lotesService = require('../src/services/lotes.service');
const entrada = { producto_id: 1, usuario_id: 2, cantidad: 5, motivo: 'Compra', lote_id: 1 };

test('estado de productos: HTTP autenticado sin MariaDB', async t => {
 const anterior = process.env.JWT_SECRET; process.env.JWT_SECRET = 'clave-solo-pruebas-estado';
 const app = express(); app.use(express.json()); app.use('/api/productos', require('../src/routes/productos.routes')); app.use('/api/movimientos', require('../src/routes/movimientos.routes'));
 const server = http.createServer(app); await new Promise(r => server.listen(0,'127.0.0.1',r));
 t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
 async function llamar(body, id = '1', rol = 1, ruta = null, method = 'PATCH') {
  const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/' + (ruta || 'productos/' + id + '/estado'), { method, headers: { 'Content-Type':'application/json', ...(rol ? { Authorization: 'Bearer ' + jwt.sign({ id: rol }, process.env.JWT_SECRET) } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
 }
 await t.test('desactiva, mantiene inventario e historial y reactiva', async () => {
  reset(); const copia = structuredClone({ lotes, historial });
  assert.equal((await llamar({ estado:'inactivo' })).body.producto.estado, 'inactivo');
  assert.equal((await llamar({ estado:'activo' })).body.producto.estado, 'activo');
  assert.deepEqual({ lotes, historial }, copia);
  const updates = eventos.filter(e => e.sql?.startsWith('UPDATE'));
  assert.ok(updates.every(e => e.sql === 'UPDATE productos SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?'));
 });
 await t.test('idempotencia no escribe ni cambia fecha', async () => {
  reset(); const antes = structuredClone(producto); assert.equal((await llamar({ estado:'activo' })).status,200);
  assert.deepEqual(producto,antes); assert.ok(!eventos.some(e => e.sql?.startsWith('UPDATE')));
 });
 await t.test('JWT y permisos de los tres roles', async () => {
  reset(); assert.equal((await llamar({ estado:'inactivo' },'1',0)).status,401);
  for (const rol of [2,3]) assert.equal((await llamar({ estado:'inactivo' },'1',rol)).status,403);
  assert.equal(producto.estado,'activo'); assert.equal((await llamar({ estado:'inactivo' })).status,200);
 });
 await t.test('rechaza campos, estados e identificadores inválidos; inexistente 404', async () => {
  reset(); for (const body of [{},[],{estado:true},{estado:'ACTIVO'},{estado:'borrado'},{estado:'activo',stock_actual:0},{estado:'activo',id:1}]) assert.equal((await llamar(body)).status,400);
  for (const id of ['0','-1','1.5','1e0','abc','9007199254740992']) assert.equal((await llamar({estado:'activo'},id)).status,400);
  assert.equal((await llamar({estado:'activo'},'99')).status,404);
 });
 await t.test('409 para movimientos y lotes; ninguna escritura tras rechazo', async () => {
  for (const rol of [1,2]) for (const [ruta,body] of [['movimientos/entrada',entrada],['movimientos/entrada',{...entrada,lote_id:undefined,nuevo_lote:{}}],['movimientos/salida',{producto_id:1,cantidad:1,motivo:'Venta'}]]) {
   reset(); producto.estado='inactivo'; const res=await llamar(body,'1',rol,ruta,'POST'); assert.equal(res.status,409); assert.match(res.body.error,/inactivo/);
   assert.ok(!eventos.some(e => /^(INSERT|UPDATE)/.test(e.sql || ''))); assert.ok(eventos.includes('rollback'));
  }
  reset(); producto.estado='inactivo'; assert.equal((await llamar({},'1',1,'productos/1/lotes','POST')).status,409);
  assert.ok(!eventos.some(e => e.sql?.startsWith('INSERT')));
 });
});

test('bloqueos producto antes de lotes, FEFO tras reactivación y transacción única', async () => {
 for (const operacion of [() => productos.cambiarEstadoProducto(1,{estado:'inactivo'}), () => movimientos.registrarEntrada(entrada), () => movimientos.registrarEntrada({...entrada,lote_id:undefined,nuevo_lote:{}}), () => movimientos.registrarSalida(entrada), () => lotesService.crearLote(1,{})]) {
  reset(); await operacion(); const consultas=eventos.filter(e => e.sql);
  assert.equal(consultas[0].sql,'SELECT id, estado FROM productos WHERE id = ? FOR UPDATE');
  assert.equal(eventos[0],'begin'); assert.equal(eventos.filter(e => e === 'begin').length,1); assert.equal(eventos.filter(e => e === 'commit').length,1);
 }
 reset(); await productos.cambiarEstadoProducto(1,{estado:'inactivo'}); await productos.cambiarEstadoProducto(1,{estado:'activo'}); eventos=[];
 const salida=await movimientos.registrarSalida(entrada); assert.deepEqual(salida.lotes.map(l => l.cantidad),[3,2]);
 assert.ok(eventos.some(e => e.sql?.includes('fecha_vencimiento ASC, id ASC FOR UPDATE')));
});

test('reportes incluyen inactivos y distinguen estado del producto y stock en CSV/Excel', async () => {
 const { filtrarStock, matrizReporte, generarCSV, celdasExcel, filtrarVencimientos } = await import('../frontend/src/reportes.utils.js');
 const lista=[{ id:1,nombre:'Prueba',codigo:'P',estado:'inactivo',stock_actual:7,stock_minimo:2 }];
 const filas=filtrarStock(lista,{}); assert.equal(filas.length,1);
 const matriz=matrizReporte('stock',filas); assert.deepEqual(matriz[0].slice(-2),['Estado del producto','Estado del stock']); assert.deepEqual(matriz[1].slice(-2),['inactivo','Stock normal']);
 assert.match(generarCSV(matriz),/inactivo/); assert.equal(celdasExcel(matriz)[1][5].value,'inactivo');
 assert.equal(filtrarVencimientos([{producto_estado:'inactivo',dias_restantes:-1}],7).length,1);
});
