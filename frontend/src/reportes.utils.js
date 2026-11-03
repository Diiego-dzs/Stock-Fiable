import { fechaVencimiento } from './alertas.utils.js';
export function filtrarStock(productos, filtros) {
  const texto = (filtros.busqueda || '').trim().toLocaleLowerCase('es');
  return productos.filter(p => (!filtros.categoria_id || String(p.categoria_id) === filtros.categoria_id) && (!texto || `${p.nombre} ${p.codigo}`.toLocaleLowerCase('es').includes(texto)));
}
export function totalesStock(filas) {
  return filas.reduce((r, p) => {
    const stock = Number(p.stock_actual);
    r.productos++; r.unidades += stock;
    if (stock === 0) r.sinStock++;
    else if (stock <= Number(p.stock_minimo)) r.stockBajo++;
    return r;
  }, { productos: 0, unidades: 0, sinStock: 0, stockBajo: 0 });
}
export function filtrarVencimientos(lotes, dias) {
  return lotes.filter(l => l.dias_restantes != null && Number(l.dias_restantes) <= Number(dias));
}
export function parametrosMovimientos(filtros, pagina = 1, exportar = false) {
  if (filtros.fecha_desde && filtros.fecha_hasta && filtros.fecha_desde > filtros.fecha_hasta) throw new Error('La fecha desde no puede ser posterior a la fecha hasta');
  const params = new URLSearchParams({ page: String(pagina), limite: '10' });
  for (const campo of ['fecha_desde', 'fecha_hasta', 'producto_id', 'tipo']) if (filtros[campo]) params.set(campo, filtros[campo]);
  if (exportar) params.set('exportar', '1');
  return params.toString();
}
export function textoSeguro(valor) {
  const texto = String(valor ?? '');
  // Control characters must be recognized to prevent spreadsheet formula injection.
  // eslint-disable-next-line no-control-regex
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(texto) || /^[\t\r\n]/u.test(texto) ? `'${texto}` : texto;
}
export function generarCSV(matriz) {
  return '\uFEFF' + matriz.map(fila => fila.map(valor => `"${textoSeguro(valor).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
export function celdasExcel(matriz) {
  return matriz.map((fila, i) => fila.map(valor => ({ type: typeof valor === 'number' ? Number : String, value: typeof valor === 'number' ? valor : textoSeguro(valor), ...(i === 0 ? { fontWeight: 'bold', backgroundColor: '#004643', textColor: '#F0EDE5' } : {}) })));
}
export function matrizReporte(tipo, filas) {
  if (tipo === 'stock') return [['Código', 'Producto', 'Categoría', 'Stock disponible', 'Stock mínimo', 'Estado'], ...filas.map(p => [p.codigo, p.nombre, p.categoria, Number(p.stock_actual), Number(p.stock_minimo), Number(p.stock_actual) === 0 ? 'Sin stock' : Number(p.stock_actual) <= Number(p.stock_minimo) ? 'Stock bajo' : 'Stock normal'])];
  if (tipo === 'vencimientos') return [['Producto', 'Código', 'Lote', 'Vencimiento', 'Stock', 'Días restantes'], ...filas.map(l => [l.producto, l.codigo, l.codigo_lote, fechaVencimiento(l.fecha_vencimiento), Number(l.stock_actual), Number(l.dias_restantes)])];
  return [['Fecha (Argentina)', 'Producto', 'Código', 'Tipo', 'Cantidad', 'Motivo', 'Observaciones', 'Responsable'], ...filas.map(m => [new Date(m.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }), m.producto, m.codigo, m.tipo, Number(m.cantidad), m.motivo, m.observacion, m.usuario_responsable || 'Sin responsable registrado'])];
}
export function nombreArchivo(tipo, extension, fecha = new Date()) {
  return `stock-fiable-${tipo}-${fecha.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })}.${extension}`;
}
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a'); enlace.href = url; enlace.download = nombre;
  document.body.appendChild(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
