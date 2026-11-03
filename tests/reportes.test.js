const { test } = require('node:test');
const assert = require('node:assert/strict');
const consultas = [];
const movimientos = Array.from({ length: 25 }, (_, id) => ({ id, producto: '=1+1', tipo: 'ENTRADA', cantidad: 2, fecha: '2026-11-02T15:00:00Z', motivo: 'Compra', observacion: 'Texto, "comillas"\nsalto' }));
require.cache[require.resolve('../src/config/db')] = { exports: { getConnection: async () => ({
  query: async (sql, params) => {
    consultas.push({ sql, params });
    if (sql.includes('COUNT(*)')) return [{ total: 25 }];
    return sql.includes('LIMIT ? OFFSET ?') ? movimientos.slice(params.at(-1), params.at(-1) + params.at(-2)) : movimientos;
  }, release() {}
}) } };

test('paginación y exportación completa conservan filtros parametrizados', async () => {
  const servicio = require('../src/services/movimientos.service');
  const filtros = { fecha_desde: '2026-11-01', fecha_hasta: '2026-11-02', producto_id: 4, tipo: 'ENTRADA', pagina: 2, limite: 10 };
  const pagina = await servicio.obtenerMovimientos(filtros);
  assert.equal(pagina.total, 25); assert.equal(pagina.total_paginas, 3);
  assert.equal(pagina.movimientos.length, 10); assert.equal(pagina.movimientos[0].id, 10);
  const todos = await servicio.obtenerMovimientos({ ...filtros, exportar: true });
  assert.equal(todos.movimientos.length, 25);
  assert.deepEqual(consultas.at(-1).params, ['2026-11-01 00:00:00', '2026-11-02 23:59:59', 'ENTRADA', 4]);
  assert.ok(!consultas.at(-1).sql.includes('LIMIT'));
  assert.ok(consultas.every(q => q.sql.trim().startsWith('SELECT')));
});

test('filtros de stock, cálculos y límites inclusivos de vencimiento', async () => {
  const u = await import('../frontend/src/reportes.utils.js');
  const productos = [{ nombre: 'Leche', codigo: 'LAC-01', categoria_id: 1, stock_actual: '0', stock_minimo: '3' }, { nombre: 'Pan', codigo: 'PAN-01', categoria_id: 2, stock_actual: '2', stock_minimo: '2' }, { nombre: 'Agua', codigo: 'BEB-01', categoria_id: 2, stock_actual: '5', stock_minimo: '1' }];
  assert.equal(u.filtrarStock(productos, { busqueda: ' lac ', categoria_id: '1' }).length, 1);
  assert.equal(u.filtrarStock(productos, { busqueda: 'LECHE', categoria_id: '2' }).length, 0);
  assert.deepEqual(u.totalesStock(productos), { productos: 3, unidades: 7, sinStock: 1, stockBajo: 1 });
  assert.equal(u.totalesStock([]).unidades, 0);
  const lotes = [-5, 0, 7, 8, 15, 16, 30, 31].map(d => ({ dias_restantes: d }));
  for (const [dias, cantidad] of [[7, 3], [15, 5], [30, 7]]) assert.equal(u.filtrarVencimientos(lotes, dias).length, cantidad);
  assert.throws(() => u.parametrosMovimientos({ fecha_desde: '2026-11-03', fecha_hasta: '2026-11-01' }));
  const params = new URLSearchParams(u.parametrosMovimientos({ producto_id: '4', tipo: 'SALIDA' }, 3, true));
  assert.equal(params.get('page'), '3'); assert.equal(params.get('exportar'), '1'); assert.equal(params.get('tipo'), 'SALIDA');
});

test('CSV escapa comillas, separadores y saltos; neutraliza fórmulas', async () => {
  const u = await import('../frontend/src/reportes.utils.js');
  for (const texto of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\n=1']) assert.ok(u.textoSeguro(texto).startsWith("'"));
  assert.equal(u.textoSeguro(null), '');
  const csv = u.generarCSV([['Nombre', 'Cantidad'], ['Texto, "citado"\nsalto', 2], ['=1+1', null]]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Texto, ""citado""\nsalto","2"'));
  assert.ok(csv.includes('"\'=1+1",""'));
  assert.equal(u.nombreArchivo('stock', 'csv', new Date('2026-11-02T01:00:00Z')), 'stock-fiable-stock-2026-11-01.csv');
});

test('XLSX real incluye todas las filas y celdas de texto sin fórmulas', async () => {
  const u = await import('../frontend/src/reportes.utils.js');
  const { default: escribir } = await import('../frontend/node_modules/write-excel-file/node/index.js');
  const { unzipSync, strFromU8 } = await import('../frontend/node_modules/fflate/esm/index.mjs');
  const matriz = u.matrizReporte('movimientos', movimientos);
  const celdas = u.celdasExcel(matriz);
  assert.equal(celdas.length, 26); assert.equal(celdas[1][1].type, String);
  assert.equal(celdas[1][4].type, Number);
  const buffer = await escribir(celdas).toBuffer();
  const archivos = unzipSync(new Uint8Array(buffer));
  const xml = strFromU8(archivos['xl/worksheets/sheet1.xml']);
  assert.equal((xml.match(/<row\b/g) || []).length, 26);
  assert.ok(!xml.includes('<f>'));
  assert.ok(Object.values(archivos).some(a => strFromU8(a).includes('=1+1')));
});

test('controlador exporta todos los registros y rechaza rangos invertidos', async () => {
  const controller = require('../src/controllers/movimientos.controller');
  let status = 200, body;
  const res = { status(n) { status = n; return this; }, json(data) { body = data; } };
  await controller.obtenerMovimientos({ query: { exportar: '1', tipo: 'ENTRADA' } }, res);
  assert.equal(body.movimientos.length, 25);
  await controller.obtenerMovimientos({ query: { fecha_desde: '2026-11-03', fecha_hasta: '2026-11-01' } }, res);
  assert.equal(status, 400);
});
