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

export const FILTROS_PRODUCTOS_INICIALES = Object.freeze({ busqueda: '', categoria_id: '', estado: '', stock: '', orden: 'nombre-asc' });
const comparadorTexto = new Intl.Collator('es', { sensitivity: 'base' });

export function estadoStockProducto(producto) {
  const stock = Number(producto.stock_actual);
  if (stock === 0) return 'sin-stock';
  if (stock > 0 && stock <= Number(producto.stock_minimo)) return 'bajo';
  if (stock > Number(producto.stock_minimo)) return 'normal';
  return '';
}

export function filtrarProductos(productos, filtros = FILTROS_PRODUCTOS_INICIALES) {
  const texto = (filtros.busqueda || '').trim().toLocaleLowerCase('es');
  const [campo, direccion] = (filtros.orden || 'nombre-asc').split('-');
  return productos.filter(p =>
    (!texto || [p.nombre, p.codigo].some(valor => String(valor ?? '').toLocaleLowerCase('es').includes(texto))) &&
    (!filtros.categoria_id || String(p.categoria_id) === String(filtros.categoria_id)) &&
    (!filtros.estado || p.estado === filtros.estado) &&
    (!filtros.stock || estadoStockProducto(p) === filtros.stock)
  ).sort((a, b) => {
    const diferencia = campo === 'stock' ? Number(a.stock_actual) - Number(b.stock_actual)
      : comparadorTexto.compare(String(a[campo] ?? ''), String(b[campo] ?? ''));
    return (direccion === 'desc' ? -diferencia : diferencia) || Number(a.id) - Number(b.id);
  });
}

export function categoriasProductos(productos) {
  return [...new Map(productos.map(p => [String(p.categoria_id), { id: String(p.categoria_id), nombre: p.categoria }])).values()]
    .sort((a, b) => comparadorTexto.compare(a.nombre, b.nombre) || Number(a.id) - Number(b.id));
}
