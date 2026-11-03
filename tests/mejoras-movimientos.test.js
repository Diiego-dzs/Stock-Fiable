const { test } = require('node:test');
const assert = require('node:assert/strict');

test('stock informativo coincide con el producto seleccionado y admite falta de datos', async () => {
  const { obtenerStockDisponible } = await import('../frontend/src/movimientos.utils.js');
  const productos = [{ id: 1, stock_actual: '12' }, { id: 2, stock_actual: 0 }, { id: 3, stock_actual: 'incorrecto' }];
  assert.equal(obtenerStockDisponible(productos, '1'), 12);
  assert.equal(obtenerStockDisponible(productos, '2'), 0);
  assert.equal(obtenerStockDisponible(productos, ''), null);
  assert.equal(obtenerStockDisponible(productos, '99'), null);
  assert.equal(obtenerStockDisponible(productos, '3'), null);
});
test('aviso previo de stock insuficiente respeta el límite y recomienda actualizar', async () => {
  const { avisoStockInsuficiente } = await import('../frontend/src/movimientos.utils.js');
  assert.equal(avisoStockInsuficiente('10', 10), '');
  assert.equal(avisoStockInsuficiente('9', 10), '');
  assert.equal(avisoStockInsuficiente('100', null), '');
  assert.match(avisoStockInsuficiente('11', 10), /Disponible: 10/);
  assert.match(avisoStockInsuficiente('1', 0), /Actualizá el inventario/);
});
test('sugerencias ofrecen motivos diferentes para entradas y salidas', async () => {
  const { MOTIVOS_MOVIMIENTO } = await import('../frontend/src/movimientos.utils.js');
  assert.ok(MOTIVOS_MOVIMIENTO.ENTRADA.includes('Compra a proveedor'));
  assert.ok(MOTIVOS_MOVIMIENTO.SALIDA.includes('Venta'));
  assert.ok(!MOTIVOS_MOVIMIENTO.ENTRADA.includes('Venta'));
});
