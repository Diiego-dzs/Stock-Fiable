import { useEffect, useState } from 'react';
import { filtrarStock, totalesStock, filtrarVencimientos, parametrosMovimientos, matrizReporte, generarCSV, celdasExcel, nombreArchivo, descargar } from './reportes.utils.js';

export default function Reportes({ token, apiUrl, solicitarApi }) {
  const [tipo, setTipo] = useState('stock');
  const [filtros, setFiltros] = useState({ busqueda: '', categoria_id: '', dias: '30', fecha_desde: '', fecha_hasta: '', producto_id: '', tipo: '' });
  const [aplicados, setAplicados] = useState(filtros);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [productos, setProductos] = useState([]);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  async function solicitar(ruta, signal) {
    return solicitarApi(ruta, { signal });
  }
  useEffect(() => {
    const controller = new AbortController();
    async function cargar() {
      try {
        const [lista, resultado] = await Promise.all([
          solicitar('/productos', controller.signal),
          tipo === 'movimientos' ? solicitar(`/movimientos?${parametrosMovimientos(aplicados, pagina)}`, controller.signal) : tipo === 'vencimientos' ? solicitar('/stock/vencimientos', controller.signal) : Promise.resolve(null)
        ]);
        if (!controller.signal.aborted) { setProductos(lista); setDatos(tipo === 'stock' ? lista : resultado); }
      } catch (e) { if (!controller.signal.aborted) { setDatos(null); setError(e.message); } }
      finally { if (!controller.signal.aborted) setCargando(false); }
    }
    cargar();
    return () => controller.abort();
    // Requests follow applied filters, pagination and report selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl, solicitarApi, tipo, aplicados, pagina, recarga]);
  function consultar(evento) {
    evento.preventDefault();
    try { if (tipo === 'movimientos') parametrosMovimientos(filtros); } catch (e) { setError(e.message); return; }
    setCargando(true); setError(''); setPagina(1); setAplicados({ ...filtros });
  }
  const filas = !datos ? [] : tipo === 'stock' ? filtrarStock(datos, aplicados) : tipo === 'vencimientos' ? filtrarVencimientos(datos, aplicados.dias) : datos.movimientos;
  const matriz = matrizReporte(tipo, filas);
  const totales = tipo === 'stock' ? totalesStock(filas) : null;
  async function exportar(formato) {
    setExportando(true); setError('');
    try {
      const completas = tipo === 'movimientos' ? (await solicitar(`/movimientos?${parametrosMovimientos(aplicados, 1, true)}`)).movimientos : filas;
      const contenido = matrizReporte(tipo, completas);
      let blob;
      if (formato === 'csv') blob = new Blob([generarCSV(contenido)], { type: 'text/csv;charset=utf-8' });
      else {
        if (contenido.length > 1048576) throw new Error('El reporte supera el máximo de filas de Excel. Reducí el rango de fechas o descargá CSV.');
        const { default: writeExcelFile } = await import('write-excel-file/browser');
        blob = await writeExcelFile(celdasExcel(contenido), { sheet: 'Reporte', columns: contenido[0].map(() => ({ width: 24 })) }).toBlob();
      }
      descargar(blob, nombreArchivo(tipo, formato));
    } catch (e) { setError(`No se pudo exportar: ${e.message}`); }
    finally { setExportando(false); }
  }
  const campo = (clave, valor) => setFiltros(f => ({ ...f, [clave]: valor }));
  return <section className="stock-panel" aria-busy={cargando || exportando}>
    <h2>Reportes y exportaciones</h2>
    <div className="stock-tabs">{[['stock', 'Stock actual'], ['movimientos', 'Movimientos'], ['vencimientos', 'Vencimientos']].map(([valor, etiqueta]) => <button key={valor} disabled={exportando} className={tipo === valor ? 'activo' : ''} onClick={() => { setTipo(valor); setPagina(1); setDatos(null); setCargando(true); setError(''); setRecarga(n => n + 1); }}>{etiqueta}</button>)}</div>
    <form className="stock-form" onSubmit={consultar}>
      {tipo === 'stock' && <><label>Nombre o código<input value={filtros.busqueda} onChange={e => campo('busqueda', e.target.value)} /></label><label>Categoría<select value={filtros.categoria_id} onChange={e => campo('categoria_id', e.target.value)}><option value="">Todas</option>{[...new Map(productos.map(p => [p.categoria_id, p.categoria])).entries()].map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label></>}
      {tipo === 'movimientos' && <><label>Desde<input type="date" value={filtros.fecha_desde} onChange={e => campo('fecha_desde', e.target.value)} /></label><label>Hasta<input type="date" value={filtros.fecha_hasta} onChange={e => campo('fecha_hasta', e.target.value)} /></label><label>Producto<select value={filtros.producto_id} onChange={e => campo('producto_id', e.target.value)}><option value="">Todos</option>{productos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}</select></label><label>Tipo<select value={filtros.tipo} onChange={e => campo('tipo', e.target.value)}><option value="">Todos</option><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option></select></label></>}
      {tipo === 'vencimientos' && <label>Vencidos y próximos vencimientos<select value={filtros.dias} onChange={e => campo('dias', e.target.value)}>{[7, 15, 30].map(n => <option key={n} value={n}>Hasta {n} días (incluye vencidos)</option>)}</select></label>}
      <button className="stock-primario" disabled={cargando || exportando}>Aplicar filtros / actualizar</button>
    </form>
    <p className="stock-ayuda">El reporte de stock incluye productos activos e inactivos; el resumen operativo del Panel considera solo activos. Las exportaciones usan los filtros aplicados. Movimientos incluye todos los registros coincidentes, aunque la vista esté paginada.</p>
    <div className="stock-tabs"><button disabled={cargando || exportando || !datos || !filas.length} onClick={() => exportar('csv')}>Descargar CSV</button><button disabled={cargando || exportando || !datos || !filas.length} onClick={() => exportar('xlsx')}>Descargar Excel</button></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {exportando && <p role="status">Preparando exportación completa...</p>}
    {cargando ? <p role="status">Cargando reporte...</p> : datos && <>
      <div className="alertas-contadores" aria-live="polite">{(totales ? [['Productos', totales.productos], ['Unidades', totales.unidades], ['Sin stock', totales.sinStock], ['Stock bajo', totales.stockBajo]] : [['Registros', tipo === 'movimientos' ? datos.total : filas.length], ...(tipo === 'vencimientos' ? [['Vencidos', filas.filter(l => Number(l.dias_restantes) < 0).length]] : [])]).map(([titulo, valor]) => <div className="alertas-contador" key={titulo}><span>{titulo}</span><strong>{valor}</strong></div>)}</div>
      {!filas.length ? <p>No hay registros para los filtros aplicados.</p> : <div className="stock-tabla-scroll"><table className="products-table"><thead><tr>{matriz[0].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{matriz.slice(1).map((fila, i) => <tr key={filas[i].id}>{fila.map((v, j) => <td key={j}>{v ?? '-'}</td>)}</tr>)}</tbody></table></div>}
      {tipo === 'movimientos' && <div className="stock-paginacion"><button disabled={pagina <= 1 || exportando} onClick={() => { setCargando(true); setPagina(p => p - 1); }}>Anterior</button><span>Página {pagina} de {Math.max(1, datos.total_paginas)} · {datos.total} registros</span><button disabled={pagina >= datos.total_paginas || exportando} onClick={() => { setCargando(true); setPagina(p => p + 1); }}>Siguiente</button></div>}
    </>}
  </section>;
}
