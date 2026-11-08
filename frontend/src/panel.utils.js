export function distribucionStock(resumen) {
 return [['Stock normal', 'productos_stock_normal'], ['Stock bajo', 'productos_stock_bajo'], ['Sin stock', 'productos_sin_stock']].map(([etiqueta, campo]) => ({ etiqueta, cantidad: Number(resumen?.[campo] || 0), porcentaje: Number(resumen?.total_productos) > 0 ? Number(resumen[campo] || 0) / Number(resumen.total_productos) * 100 : 0 }));
}
export function alertasProductos(productos) {
 return productos.filter(p => p.estado === 'activo' && Number(p.stock_actual) <= Number(p.stock_minimo)).map(p => ({ ...p, alerta: Number(p.stock_actual) === 0 ? 'SIN_STOCK' : 'STOCK_BAJO' }));
}
