const { test } = require('node:test');
const assert = require('node:assert/strict');
const utils = () => import('../frontend/src/productos.utils.js');
const productos = Object.freeze([
  Object.freeze({ id: 3, nombre: 'Yerba', codigo: 'Y-10', categoria_id: 1, categoria: 'Almacén', estado: 'activo', stock_actual: '10', stock_minimo: '2' }),
  Object.freeze({ id: 1, nombre: 'Arroz', codigo: 'A-20', categoria_id: 1, categoria: 'Almacén', estado: 'activo', stock_actual: '2', stock_minimo: '2' }),
  Object.freeze({ id: 2, nombre: 'Leche', codigo: 'L-01', categoria_id: 2, categoria: 'Lácteos', estado: 'inactivo', stock_actual: '0', stock_minimo: '0' }),
  Object.freeze({ id: 4, nombre: 'Arroz', codigo: 'A-10', categoria_id: 1, categoria: 'Almacén', estado: 'inactivo', stock_actual: '20', stock_minimo: '3' })
]);
const ids = filas => filas.map(p => p.id);

test('búsqueda parcial por nombre o código sin distinguir mayúsculas y espacios exteriores', async () => {
  const { filtrarProductos } = await utils();
  for (const busqueda of [' arroZ ', 'ARRO', 'arroz']) assert.deepEqual(ids(filtrarProductos(productos, { busqueda })), [1, 4]);
  assert.deepEqual(ids(filtrarProductos(productos, { busqueda: ' l-0 ' })), [2]);
  assert.equal(filtrarProductos(productos, { busqueda: '   ' }).length, 4);
  assert.deepEqual(filtrarProductos(productos, { busqueda: 'inexistente' }), []);
});

test('categorías provienen de la colección completa y se filtran por identificador', async () => {
  const { filtrarProductos, categoriasProductos } = await utils();
  assert.deepEqual(categoriasProductos(productos), [{ id: '1', nombre: 'Almacén' }, { id: '2', nombre: 'Lácteos' }]);
  assert.deepEqual(ids(filtrarProductos(productos, { categoria_id: '2' })), [2]);
  assert.equal(filtrarProductos(productos, { categoria_id: 1 }).length, 3);
});

test('estado y stock son independientes; cero, mínimo exacto y normal', async () => {
  const { filtrarProductos, estadoStockProducto } = await utils();
  assert.deepEqual(productos.map(estadoStockProducto), ['normal', 'bajo', 'sin-stock', 'normal']);
  assert.deepEqual(ids(filtrarProductos(productos, { estado: 'inactivo' })), [4, 2]);
  assert.deepEqual(ids(filtrarProductos(productos, { estado: 'inactivo', stock: 'normal' })), [4]);
  assert.deepEqual(ids(filtrarProductos(productos, { stock: 'bajo' })), [1]);
  assert.deepEqual(ids(filtrarProductos(productos, { stock: 'sin-stock' })), [2]);
});

test('todos los filtros combinan mediante AND', async () => {
  const { filtrarProductos } = await utils();
  const filtros = { busqueda: 'a-', categoria_id: '1', estado: 'activo', stock: 'bajo' };
  assert.deepEqual(ids(filtrarProductos(productos, filtros)), [1]);
  assert.deepEqual(filtrarProductos(productos, { ...filtros, estado: 'inactivo' }), []);
});

test('orden textual y numérico con desempate por id sin mutar la fuente', async () => {
  const { filtrarProductos } = await utils();
  const copia = structuredClone(productos);
  const ordenes = { 'nombre-asc': [1,4,2,3], 'nombre-desc': [3,2,1,4], 'codigo-asc': [4,1,2,3], 'codigo-desc': [3,2,1,4], 'stock-asc': [2,1,3,4], 'stock-desc': [4,3,1,2] };
  for (const [orden, resultado] of Object.entries(ordenes)) assert.deepEqual(ids(filtrarProductos(productos, { orden })), resultado);
  assert.deepEqual(productos, copia);
  assert.equal(filtrarProductos(productos)[0], productos[1]);
  assert.deepEqual(ids(filtrarProductos([{ ...productos[0], id: 8 }, { ...productos[0], id: 7 }], { orden: 'stock-desc' })), [7,8]);
});

test('limpieza y recálculo tras editar o cambiar estado conservan filtros y colección', async () => {
  const { filtrarProductos, FILTROS_PRODUCTOS_INICIALES } = await utils();
  const filtros = Object.freeze({ busqueda: 'arroz', estado: 'activo' });
  assert.deepEqual(ids(filtrarProductos(productos, filtros)), [1]);
  const editados = productos.map(p => p.id === 1 ? { ...p, nombre: 'Fideos' } : p);
  assert.deepEqual(filtrarProductos(editados, filtros), []);
  const inactivos = productos.map(p => p.id === 1 ? { ...p, estado: 'inactivo' } : p);
  assert.deepEqual(filtrarProductos(inactivos, filtros), []);
  assert.equal(inactivos.find(p => p.id === 1).stock_actual, '2');
  assert.equal(filtrarProductos(inactivos, FILTROS_PRODUCTOS_INICIALES).length, productos.length);
  assert.deepEqual(filtrarProductos([], FILTROS_PRODUCTOS_INICIALES), []);
});

test('el filtrado no altera los datos del Panel, movimientos ni la búsqueda de detalles', async () => {
  const { filtrarProductos } = await utils();
  const { alertasProductos } = await import('../frontend/src/panel.utils.js');
  const { obtenerStockDisponible } = await import('../frontend/src/movimientos.utils.js');
  const alertasAntes = alertasProductos(productos);
  const detalle = productos.find(p => p.id === 4);
  const visibles = filtrarProductos(productos, { estado: 'activo', stock: 'bajo' });
  assert.deepEqual(ids(visibles), [1]);
  assert.equal(productos.find(p => p.id === 4), detalle);
  assert.deepEqual(alertasProductos(productos), alertasAntes);
  assert.equal(obtenerStockDisponible(productos, '3'), 10);
  assert.deepEqual(ids(productos.filter(p => p.estado === 'activo')), [3,1]);
  const actualizado = productos.map(p => p.id === 4 ? { ...p, estado: 'activo' } : p);
  assert.equal(actualizado.find(p => p.id === detalle.id).stock_actual, detalle.stock_actual);
  assert.equal(filtrarProductos(actualizado, { estado: 'inactivo' }).some(p => p.id === detalle.id), false);
  assert.equal(actualizado.length, productos.length);
});

test('controles accesibles, contador y eventos locales de filtrado y limpieza', async t => {
  const path = require('node:path');
  const { createServer } = await import('../frontend/node_modules/vite/dist/node/index.js');
  const servidor = await createServer({ root: path.resolve('frontend'), server: { middlewareMode: true }, appType: 'custom' });
  t.after(() => servidor.close());
  const { default: ProductosFiltros } = await servidor.ssrLoadModule('/src/ProductosFiltros.jsx');
  const React = require('../frontend/node_modules/react');
  const { renderToStaticMarkup } = require('../frontend/node_modules/react-dom/server');
  const { categoriasProductos, filtrarProductos, FILTROS_PRODUCTOS_INICIALES } = await utils();
  let filtros = { ...FILTROS_PRODUCTOS_INICIALES, busqueda: 'arroz', categoria_id: '1', estado: 'activo', stock: 'bajo', orden: 'stock-desc' };
  const props = () => ({ filtros, onChange: valor => { filtros = typeof valor === 'function' ? valor(filtros) : valor; }, categorias: categoriasProductos(productos), cantidad: filtrarProductos(productos, filtros).length, total: productos.length });
  let html = renderToStaticMarkup(React.createElement(ProductosFiltros, props()));
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /1 de 4 productos/);
  for (const etiqueta of ['Nombre o código', 'Categoría', 'Estado del producto', 'Estado del stock', 'Ordenar por', 'Limpiar filtros', 'Lácteos']) assert.ok(html.includes(etiqueta), etiqueta);
  const nodos = [];
  function recorrer(elemento) {
    if (Array.isArray(elemento)) { elemento.forEach(recorrer); return; }
    if (!elemento?.props) return;
    nodos.push(elemento); recorrer(elemento.props.children);
  }
  recorrer(ProductosFiltros(props()));
  nodos.find(n => n.type === 'input').props.onChange({ target: { value: 'no coincide' } });
  assert.equal(filtrarProductos(productos, filtros).length, 0);
  assert.equal(filtros.estado, 'activo');
  html = renderToStaticMarkup(React.createElement(ProductosFiltros, props()));
  assert.match(html, /0 de 4 productos/);
  nodos.find(n => n.type === 'button').props.onClick();
  assert.deepEqual(filtros, FILTROS_PRODUCTOS_INICIALES);
  html = renderToStaticMarkup(React.createElement(ProductosFiltros, props()));
  assert.match(html, /4 de 4 productos/);
  assert.equal(productos.length, 4);
});
