import { useEffect, useState } from 'react';
import { agruparAlertas, fechaVencimiento } from './alertas.utils.js';

export default function Alertas({ token, apiUrl, solicitarApi, onVerProducto, datosPanel }) {
  const [dias, setDias] = useState(30);
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function cargar() {
      try {
        const resultados = await Promise.all(['/stock/alertas', '/stock/alertas-vencimiento'].map(async ruta => {
          if (ruta === '/stock/alertas-vencimiento' && datosPanel) return datosPanel.cargar('vencimientos');
          return solicitarApi(ruta, { signal: controller.signal });
        }));
        if (!controller.signal.aborted) setDatos({ stock: resultados[0], vencimientos: resultados[1] });
      } catch (e) {
        if (!controller.signal.aborted) { setDatos(null); setError(e.message); }
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    cargar();
    return () => controller.abort();
  }, [token, apiUrl, solicitarApi, recarga, datosPanel]);

  const grupos = datos ? agruparAlertas(datos.stock, datos.vencimientos, dias) : null;
  const categorias = [
    ['sinStock', 'Productos sin stock', 'critica', 'productos'],
    ['stockBajo', 'Productos con stock bajo', 'aviso', 'productos'],
    ['proximos', `Vencimientos en ${dias} días`, 'aviso', 'lotes'],
    ['vencidos', 'Lotes vencidos', 'critica', 'lotes']
  ];

  return <section className="stock-panel alertas-panel" aria-labelledby="titulo-alertas" aria-busy={cargando}>
    <div className="section-header"><h2 id="titulo-alertas">Alertas de inventario</h2>
      <button className="stock-primario" disabled={cargando} onClick={() => { datosPanel?.invalidar(); setCargando(true); setError(''); setRecarga(n => n + 1); }}>Actualizar alertas</button>
    </div>
    <p className="stock-ayuda">Stock de productos activos y vencimientos de lotes activos con unidades disponibles. Los próximos vencimientos incluyen hoy; los vencidos se muestran por separado.</p>
    <div className="stock-tabs" role="group" aria-label="Plazo de próximos vencimientos">
      {[7, 15, 30].map(n => <button key={n} aria-pressed={dias === n} className={dias === n ? 'activo' : ''} onClick={() => setDias(n)}>Próximos {n} días</button>)}
    </div>
    {cargando ? <p role="status">Cargando alertas...</p> : error ? <div className="error-message" role="alert">{error}. Usá Actualizar alertas para reintentar.</div> : grupos && <>
      <div className="alertas-contadores" aria-live="polite">
        {categorias.map(([clave, titulo, nivel, unidad]) => <div className={`alertas-contador ${nivel}`} key={clave}>
          <span>{titulo}</span><strong>{grupos[clave].length}</strong><small>{unidad}</small>
        </div>)}
      </div>
      {categorias.map(([clave, titulo, nivel, unidad]) => <section key={clave} className="alertas-grupo" aria-labelledby={`alertas-${clave}`}>
        <h3 id={`alertas-${clave}`}>{titulo} <span className={`stock-etiqueta alerta-${nivel}`}>{grupos[clave].length}</span></h3>
        {grupos[clave].length === 0 ? <p className="stock-ayuda">No hay {unidad} en esta categoría.</p> : <div className="stock-tabla-scroll"><table className="products-table">
          <thead><tr><th>Código</th><th>Producto</th>{unidad === 'lotes' && <><th>Lote</th><th>Vencimiento</th></>}<th>Stock actual</th>{unidad === 'productos' && <th>Stock mínimo</th>}<th>Indicador</th><th>Acción</th></tr></thead>
          <tbody>{grupos[clave].map(item => <tr key={item.id}>
            <td>{item.codigo}</td><td>{item.nombre || item.producto}</td>
            {unidad === 'lotes' && <><td>{item.codigo_lote || 'Sin código'}</td><td>{fechaVencimiento(item.fecha_vencimiento)}</td></>}
            <td>{item.stock_actual}</td>{unidad === 'productos' && <td>{item.stock_minimo}</td>}
            <td><span className={`stock-etiqueta alerta-${nivel}`}>{clave === 'sinStock' ? 'Sin stock' : clave === 'stockBajo' ? 'Reponer' : clave === 'vencidos' ? `Vencido hace ${Math.abs(Number(item.dias_restantes))} días` : Number(item.dias_restantes) === 0 ? 'Vence hoy' : `Vence en ${item.dias_restantes} días`}</span></td>
            <td><button className="detail-button" onClick={() => onVerProducto(unidad === 'productos' ? item.id : item.producto_id)}>Ver producto</button></td>
          </tr>)}</tbody>
        </table></div>}
      </section>)}
    </>}
  </section>;
}
