export const CAMPOS_EDICION_PRODUCTO = ['nombre', 'descripcion', 'categoria_id', 'codigo', 'stock_minimo'];
export function valoresEdicionProducto(producto) {
  return Object.fromEntries(CAMPOS_EDICION_PRODUCTO.map(campo => [campo,
    campo === 'stock_minimo' ? String(Number(producto[campo])) : String(producto[campo] ?? '')
  ]));
}
export function cambiosProducto(valores, originales) {
  return Object.fromEntries(CAMPOS_EDICION_PRODUCTO
    .filter(campo => String(valores[campo] ?? '') !== String(originales[campo] ?? ''))
    .map(campo => [campo, valores[campo]]));
}
