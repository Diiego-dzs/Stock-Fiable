export const MOTIVOS_MOVIMIENTO = {
  ENTRADA: ['Compra a proveedor', 'Devolución de cliente', 'Ajuste de inventario'],
  SALIDA: ['Venta', 'Vencimiento', 'Rotura o daño', 'Ajuste de inventario']
};

export function obtenerStockDisponible(productos, productoId) {
  const producto = productos.find(p => Number(p.id) === Number(productoId));
  if (!producto) return null;
  const stock = Number(producto.stock_actual);
  return Number.isFinite(stock) && stock >= 0 ? stock : null;
}

export function avisoStockInsuficiente(cantidad, disponible) {
  return disponible !== null && Number(cantidad) > disponible
    ? `Stock insuficiente según el inventario cargado. Disponible: ${disponible}. Actualizá el inventario si hubo cambios.`
    : '';
}
