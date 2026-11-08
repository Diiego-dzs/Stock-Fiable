import { useEffect, useSyncExternalStore } from 'react';
import { distribucionStock, alertasProductos } from './panel.utils.js';
import { agruparAlertas, fechaVencimiento } from './alertas.utils.js';
import './PanelPrincipal.css';
function IconoPanel() {
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><path d="M3 15h18M3 21h12" /></svg>;
}
function EstadoRecurso({ recurso, reintentar, children }) {
 if (recurso.cargando || (!recurso.error && recurso.datos === null)) return <p role="status">Cargando datos...</p>;
 if (recurso.error) return <div role="alert"><p>{recurso.error}</p><button onClick={reintentar}>Reintentar esta sección</button></div>;
 return children;
}
export default function PanelPrincipal({ resumen, productos, inventario, datosPanel, onNavegar, onVerProducto, onReintentarInventario }) {
 const datos = useSyncExternalStore(datosPanel.subscribe, datosPanel.getSnapshot, datosPanel.getSnapshot);
 useEffect(() => {
  for (const clave of ['movimientos', 'vencimientos']) if (datos[clave].datos === null && !datos[clave].error && !datos[clave].cargando) void datosPanel.cargar(clave).catch(() => {});
 }, [datosPanel, datos]);
 const reintentar = clave => { void datosPanel.cargar(clave).catch(() => {}); };
 const grupos = agruparAlertas(alertasProductos(productos), datos.vencimientos.datos || [], 30);
 const tarjetas = [['Productos activos', resumen?.total_productos], ['Unidades disponibles', resumen?.unidades_totales], ['Productos con stock bajo', resumen?.productos_stock_bajo], ['Productos sin stock', resumen?.productos_sin_stock], ['Productos con stock normal', resumen?.productos_stock_normal]];
 return <div className="sf-panel">
  <header className="sf-panel-cabecera"><div><p className="sf-panel-kicker">STOCK FIABLE · INVENTARIO</p><h2>Panel principal</h2><p>Una vista de tu inventario y sus prioridades.</p></div><IconoPanel /></header>
  <p className="sf-panel-alcance">Resumen operativo: productos activos y stock de lotes activos. Los vencimientos incluyen lotes activos con unidades almacenadas, también de productos inactivos.</p>
  <section aria-label="Indicadores de inventario">
   {inventario.error && <div role="alert"><p>{inventario.error}</p><button disabled={inventario.cargando} onClick={onReintentarInventario}>Reintentar inventario</button></div>}
   {inventario.cargando && <p role="status">Actualizando inventario...</p>}
   <div className="sf-panel-indicadores">{tarjetas.map(([titulo, valor]) => <article className="sf-panel-tarjeta" key={titulo}><span>{titulo}</span><strong>{valor == null ? '—' : valor}</strong><small>{titulo === 'Unidades disponibles' ? 'unidades' : 'productos'}</small></article>)}
    {[['Lotes próximos a vencer', grupos.proximos.length], ['Lotes vencidos', grupos.vencidos.length]].map(([titulo, cantidad]) => <article className="sf-panel-tarjeta sf-panel-aviso" key={titulo}><span>{titulo}</span><strong>{datos.vencimientos.datos === null ? '—' : cantidad}</strong><small>{titulo.includes('próximos') ? 'lotes · hoy a 30 días' : 'lotes con stock'}</small></article>)}
   </div>
  </section>
  <div className="sf-panel-columnas">
   <section className="sf-panel-bloque"><h3>Distribución de stock</h3>{!resumen ? <p>{inventario.error ? 'Inventario no disponible.' : 'Cargando distribución...'}</p> : !Number(resumen.total_productos) ? <p>No hay productos activos para mostrar.</p> : <ul className="sf-panel-barras">{distribucionStock(resumen).map(({ etiqueta, cantidad, porcentaje }) => <li key={etiqueta}><div><span>{etiqueta}</span><strong>{cantidad} productos</strong></div><div role="img" aria-label={etiqueta + ': ' + cantidad + ' productos'} className="sf-panel-pista"><span style={{ width: porcentaje + '%' }} /></div></li>)}</ul>}</section>
   <section className="sf-panel-bloque"><div className="sf-panel-titulo"><h3>Movimientos recientes</h3><button onClick={() => onNavegar('movimientos')}>Ver historial</button></div>
    <EstadoRecurso recurso={datos.movimientos} reintentar={() => reintentar('movimientos')}>
     {!datos.movimientos.datos?.movimientos.length ? <p>No hay movimientos registrados.</p> : <div className="sf-panel-scroll"><table><thead><tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Fecha</th><th>Responsable</th></tr></thead><tbody>{datos.movimientos.datos.movimientos.map(m => <tr key={m.id}><td><button onClick={() => onVerProducto(m.producto_id)}>{m.producto}</button></td><td><span className={'stock-etiqueta ' + (m.tipo === 'ENTRADA' ? 'entrada' : 'salida')}>{m.tipo}</span></td><td>{m.cantidad}</td><td>{new Date(m.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td><td>{m.usuario_responsable || 'Sin responsable registrado'}</td></tr>)}</tbody></table></div>}
    </EstadoRecurso>
   </section>
   <section className="sf-panel-bloque"><div className="sf-panel-titulo"><h3>Prioridades de reposición</h3><button onClick={() => onNavegar('alertas')}>Ver alertas</button></div>
    {!resumen || inventario.error ? <p>Actualizá el inventario para consultar las prioridades.</p> : <>{[['Sin stock',grupos.sinStock],['Stock bajo',grupos.stockBajo]].map(([titulo, filas]) => <div key={titulo}><h4>{titulo} · {filas.length} productos</h4>{!filas.length ? <p>No hay productos en esta categoría.</p> : <ul className="sf-panel-lista">{filas.slice(0,5).map(p => <li key={p.id}><button onClick={() => onVerProducto(p.id)}>{p.nombre}</button><span>{p.stock_actual} / mínimo {p.stock_minimo}</span></li>)}</ul>}</div>)}</>}
   </section>
   <section className="sf-panel-bloque"><div className="sf-panel-titulo"><h3>Vencimientos</h3><button onClick={() => onNavegar('alertas')}>Ver todos</button></div><EstadoRecurso recurso={datos.vencimientos} reintentar={() => reintentar('vencimientos')}>
    {[['Vencidos',grupos.vencidos],['Próximos 30 días',grupos.proximos]].map(([titulo, filas]) => <div key={titulo}><h4>{titulo} · {filas.length} lotes</h4>{!filas.length ? <p>No hay lotes en esta categoría.</p> : <ul className="sf-panel-lista">{filas.slice(0,5).map(l => <li key={l.id}><div><button onClick={() => onVerProducto(l.producto_id)}>{l.producto}</button><small>Lote {l.codigo_lote || 'sin código'} · {l.stock_actual} unidades</small></div><span>{fechaVencimiento(l.fecha_vencimiento)}</span></li>)}</ul>}</div>)}
   </EstadoRecurso></section>
  </div>
 </div>;
}
