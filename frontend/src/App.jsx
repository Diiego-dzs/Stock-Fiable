import { useEffect, useRef, useState } from 'react';
import './App.css';
import { useSesion } from './useSesion.js';
import { MOTIVOS_MOVIMIENTO, obtenerStockDisponible, avisoStockInsuficiente } from './movimientos.utils.js';
import Sidebar from './Sidebar.jsx';
import { puedeRegistrarMovimientos } from './permisos.js';
import Usuarios from './Usuarios.jsx';
import Alertas from './Alertas.jsx';
import Reportes from './Reportes.jsx';

const API_URL = 'http://localhost:3000/api';
const filtrosIniciales = { tipo: '', producto_id: '', fecha_desde: '', fecha_hasta: '' };
const productoInicial = { codigo: '', nombre: '', descripcion: '', marca: '', categoria_id: '', precio_compra: '0', precio_venta: '0', stock_minimo: '0' };
const loteInicial = { codigo_lote: '', fecha_vencimiento: '' };
const formularioInicial = { producto_id: '', lote_id: '', cantidad: '', motivo: '', observacion: '' };

function fechaCorta(valor) {
  if (!valor) return '-';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '-' : fecha.toLocaleDateString('es-AR');
}
function fechaCompleta(valor) {
  if (!valor) return '-';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '-' : fecha.toLocaleString('es-AR');
}

function App() {
  const sesion = useSesion(API_URL);
  return <StockFiable key={sesion.token || 'sin-sesion'} sesion={sesion} />;
}

function StockFiable({ sesion }) {
  const { token, usuario } = sesion;
  const solicitudLotes = useRef(0);
  const [categorias, setCategorias] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState(null);
  const [nuevoLote, setNuevoLote] = useState(null);
  const [modalidadLote, setModalidadLote] = useState('existente');
  const [loteEntrada, setLoteEntrada] = useState(loteInicial);
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [seccionElegida, setSeccion] = useState('panel');
  const seccion = (seccionElegida === 'usuarios' && usuario?.rol !== 'Dueño') || (seccionElegida === 'registrar' && !puedeRegistrarMovimientos(usuario?.rol)) ? 'panel' : seccionElegida;
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('ENTRADA');
  const [formulario, setFormulario] = useState(formularioInicial);
  const stockDisponible = obtenerStockDisponible(productos, formulario.producto_id);
  const avisoSalida = tipoMovimiento === 'SALIDA' ? avisoStockInsuficiente(formulario.cantidad, stockDisponible) : '';
  const [lotesFormulario, setLotesFormulario] = useState([]);
  const [cargandoLotes, setCargandoLotes] = useState(false);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciales);
  const [pagina, setPagina] = useState(1);
  const [historial, setHistorial] = useState({ movimientos: [], pagina: 1, total: 0, total_paginas: 0 });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [detalleMovimiento, setDetalleMovimiento] = useState(null);

  async function solicitar(ruta, tokenActual = token, opciones = {}) {
    return sesion.solicitar(ruta, opciones, tokenActual);
  }

  useEffect(() => {
    if (token && sesion.estado === 'lista') {
      actualizarInventario().catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    }
    // Refresh inventory once after a validated login or session recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sesion.estado]);

  async function actualizarInventario(tokenActual = token) {
    const [nuevoResumen, nuevosProductos] = await Promise.all([
      solicitar('/stock/resumen', tokenActual),
      solicitar('/productos', tokenActual)
    ]);
    setResumen(nuevoResumen);
    setProductos(nuevosProductos);
    setProductoSeleccionado(anterior => anterior
      ? nuevosProductos.find(p => p.id === anterior.id) || null
      : null);
  }

  async function iniciarSesion(evento) {
    evento.preventDefault();
    setCargando(true);
    setError('');
    try {
      const respuesta = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, contrasena })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'Error al iniciar sesión');
      await sesion.establecer(datos.token);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }

  async function verDetalleProducto(producto) {
    setNuevoLote(null);
    setProductoSeleccionado(producto);
    setLotes([]);
    setCargandoDetalle(true);
    setError('');
    try { setLotes(await solicitar(`/productos/${producto.id}/lotes`)); }
    catch (e) { setError(e.message); }
    finally { setCargandoDetalle(false); }
  }

  async function cargarLotesFormulario(productoId) {
    const solicitud = ++solicitudLotes.current;
    setLotesFormulario([]);
    if (!productoId) { setCargandoLotes(false); return; }
    setCargandoLotes(true);
    try {
      const datos = await solicitar(`/productos/${productoId}/lotes`);
      if (solicitud === solicitudLotes.current) setLotesFormulario(datos.filter(l => l.estado === 'activo'));
    } catch (e) { if (solicitud === solicitudLotes.current) setError(e.message); }
    finally { if (solicitud === solicitudLotes.current) setCargandoLotes(false); }
  }

  function cambiarProductoMovimiento(id) {
    setLoteEntrada(loteInicial);
    setFormulario(anterior => ({ ...anterior, producto_id: id, lote_id: '' }));
    setError('');
    if (tipoMovimiento === 'ENTRADA') cargarLotesFormulario(id);
  }

  function cambiarTipoMovimiento(tipo) {
    ++solicitudLotes.current;
    setCargandoLotes(false);
    setModalidadLote('existente');
    setLoteEntrada(loteInicial);
    setTipoMovimiento(tipo);
    setFormulario(formularioInicial);
    setLotesFormulario([]);
    setError('');
    setMensaje('');
  }

  async function registrarMovimiento(evento) {
    evento.preventDefault();
    if (guardando) return;
    setError('');
    setMensaje('');
    const cantidad = Number(formulario.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setError('Ingresá una cantidad entera mayor a cero.');
      return;
    }
    if (avisoSalida) {
      setError(avisoSalida);
      return;
    }
    if (tipoMovimiento === 'ENTRADA' && modalidadLote === 'existente' && !formulario.lote_id) {
      setError('Seleccioná un lote para la entrada.');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        producto_id: Number(formulario.producto_id),
        cantidad,
        motivo: formulario.motivo.trim(),
        observacion: formulario.observacion.trim()
      };
      if (tipoMovimiento === 'ENTRADA') {
        if (modalidadLote === 'nuevo') cuerpo.nuevo_lote = loteEntrada;
        else cuerpo.lote_id = Number(formulario.lote_id);
      }
      const datos = await solicitar(`/movimientos/${tipoMovimiento === 'ENTRADA' ? 'entrada' : 'salida'}`, token, {
        method: 'POST', body: JSON.stringify(cuerpo)
      });
      setMensaje(datos.mensaje || 'Movimiento registrado correctamente');
      const productoId = formulario.producto_id;
      setFormulario({ ...formularioInicial, producto_id: productoId });
      setModalidadLote('existente');
      setLoteEntrada(loteInicial);
      try {
      await actualizarInventario();
      if (productoSeleccionado) {
        setLotes(await solicitar(`/productos/${productoSeleccionado.id}/lotes`));
      }
      if (tipoMovimiento === 'ENTRADA') await cargarLotesFormulario(productoId);
      if (seccion === 'movimientos') await cargarHistorial(1, filtrosAplicados);
      } catch { setError('El movimiento se guardó, pero no se pudo actualizar la vista. No repitas la operación. Usá Actualizar inventario.'); }
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  }

  async function cargarHistorial(numeroPagina = pagina, filtrosActuales = filtrosAplicados) {
    setCargandoHistorial(true);
    try {
      const parametros = new URLSearchParams({ page: String(numeroPagina), limite: '10' });
      Object.entries(filtrosActuales).forEach(([clave, valor]) => {
        if (valor) parametros.set(clave, valor);
      });
      const datos = await solicitar(`/movimientos?${parametros.toString()}`);
      setHistorial(datos);
      setPagina(numeroPagina);
    } catch (e) { setError(e.message); }
    finally { setCargandoHistorial(false); }
  }

  async function abrirDetalleMovimiento(id) {
    setError('');
    try { setDetalleMovimiento(await solicitar(`/movimientos/${id}`)); }
    catch (e) { setError(e.message); }
  }

  useEffect(() => {
    if (token && seccion === 'movimientos') cargarHistorial(1, filtrosAplicados);
    // Se ejecuta al entrar al historial; los cambios de filtro se aplican con el botón Buscar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, seccion]);

  function aplicarFiltros(evento) {
    evento.preventDefault();
    if (filtros.fecha_desde && filtros.fecha_hasta && filtros.fecha_desde > filtros.fecha_hasta) {
      setError('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }
    setError('');
    setFiltrosAplicados({ ...filtros });
    cargarHistorial(1, filtros);
  }

  async function refrescarVista() {
    await actualizarInventario();
    if (productoSeleccionado) setLotes(await solicitar(`/productos/${productoSeleccionado.id}/lotes`));
  }

  async function abrirNuevoProducto() {
    setError(''); setMensaje('');
    try { setCategorias(await solicitar('/categorias')); setNuevoProducto({ ...productoInicial }); }
    catch (e) { setError(e.message); }
  }

  async function guardarAlta(evento, tipo) {
    evento.preventDefault();
    if (guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      await solicitar(tipo === 'producto' ? '/productos' : `/productos/${productoSeleccionado.id}/lotes`, token, {
        method: 'POST', body: JSON.stringify(tipo === 'producto' ? nuevoProducto : nuevoLote)
      });
      if (tipo === 'producto') setNuevoProducto(null); else setNuevoLote(null);
      setMensaje(tipo === 'producto' ? 'Producto creado correctamente' : 'Lote creado correctamente con stock cero');
      try { await refrescarVista(); }
      catch { setError('El registro se guardó, pero no se pudo actualizar la vista. No repitas la operación. Usá Actualizar inventario.'); }
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  }

  function camposLote(valor, cambiar) {
    return <>
      <label>Código de lote (opcional)<input maxLength="100" value={valor.codigo_lote} onChange={e => cambiar({ ...valor, codigo_lote: e.target.value })} /></label>
      <label>Vencimiento (opcional)<input type="date" min="1000-01-01" max="9999-12-31" value={valor.fecha_vencimiento} onChange={e => cambiar({ ...valor, fecha_vencimiento: e.target.value })} /></label>
    </>;
  }

  function cerrarSesion() {
    setNuevoProducto(null); setNuevoLote(null); setCategorias([]); setModalidadLote('existente'); setLoteEntrada(loteInicial);
    sesion.cerrar(); setResumen(null); setProductos([]);
    setProductoSeleccionado(null); setLotes([]); setEmail(''); setContrasena('');
    setSeccion('panel'); setError(''); setMensaje(''); setFormulario(formularioInicial);
    setHistorial({ movimientos: [], pagina: 1, total: 0, total_paginas: 0 });
    setDetalleMovimiento(null);
  }

  if (token && sesion.estado !== 'lista') return <div className="app"><main className="login-container"><div className="login-card">
    <h1>Stock Fiable</h1>
    {sesion.estado === 'verificando' ? <p role="status">Verificando sesión...</p> : <><p role="alert">{sesion.error}</p><button className="login-button" onClick={() => sesion.sincronizar({ forzar: true })}>Reintentar</button></>}
    <button className="close-detail-button" onClick={cerrarSesion}>Volver al login</button>
  </div></main></div>;

  if (!token) return (
    <div className="app"><main className="login-container"><div className="login-card">
      <h1>Stock Fiable</h1><p className="login-subtitle">Sistema de gestión de stock</p>
      <form onSubmit={iniciarSesion}>
        <div className="form-group"><label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ingresá tu email" required /></div>
        <div className="form-group"><label htmlFor="contrasena">Contraseña</label>
          <input id="contrasena" type="password" value={contrasena} onChange={e => setContrasena(e.target.value)} placeholder="Ingresá tu contraseña" required /></div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" className="login-button" disabled={cargando}>{cargando ? 'Ingresando...' : 'Iniciar sesión'}</button>
      </form>
    </div></main></div>
  );

  return (
    <div className="app sf-app-con-sidebar">
      <Sidebar seccion={seccion} nuevoProductoAbierto={usuario?.rol === 'Dueño' && Boolean(nuevoProducto)} usuario={usuario} guardando={guardando}
        onNavegar={id => { setSeccion(id); setError(''); setMensaje(''); if (id === 'productos') setNuevoProducto(null); }}
        onNuevoProducto={() => { setSeccion('productos'); abrirNuevoProducto(); }}
        onActualizar={async () => { setError(''); try { await refrescarVista(); if (formulario.producto_id) await cargarLotesFormulario(formulario.producto_id); } catch (e) { setError(e.message); } }}
        onCerrarSesion={cerrarSesion} />
      <main className="main">
        {sesion.error && <div className="error-message stock-alerta" role="alert">{sesion.error} <button onClick={() => sesion.sincronizar({ forzar: true })}>Reintentar</button></div>}
        {error && <div className="error-message stock-alerta" role="alert">{error}</div>}
        {mensaje && <div className="stock-exito" role="status">{mensaje}</div>}
        {seccion === 'usuarios' && usuario?.rol === 'Dueño' && <Usuarios solicitarApi={sesion.solicitar} token={token} apiUrl={API_URL} usuarioActual={usuario} onUsuarioActualizado={() => sesion.sincronizar({ forzar: true })} />}
        {seccion === 'reportes' && <Reportes solicitarApi={sesion.solicitar} token={token} apiUrl={API_URL} />}
        {seccion === 'alertas' && <Alertas solicitarApi={sesion.solicitar} token={token} apiUrl={API_URL} onVerProducto={id => {
          const producto = productos.find(p => Number(p.id) === Number(id));
          if (!producto) { setError('El producto no está disponible. Actualizá el inventario para reintentar.'); return; }
          setSeccion('productos');
          setMensaje('');
          verDetalleProducto(producto);
        }} />}
        {seccion === 'panel' && <>
          <section className="welcome"><h2>Panel principal</h2><p>Bienvenido al sistema de gestión de inventario.</p></section>
          {!resumen ? <p>Cargando inventario...</p> : <section className="dashboard">
            {[
              ['Productos', resumen.total_productos, 'Productos registrados'],
              ['Unidades en stock', resumen.unidades_totales, 'Unidades disponibles'],
              ['Stock bajo', resumen.productos_stock_bajo, 'Necesitan reposición'],
              ['Sin stock', resumen.productos_sin_stock, 'Sin unidades disponibles'],
              ['Stock normal', resumen.productos_stock_normal, 'Stock suficiente']
            ].map(([titulo, valor, subtitulo]) => <div className="card" key={titulo}><h3>{titulo}</h3><p>{valor}</p><small>{subtitulo}</small></div>)}
          </section>}
        </>}
        {seccion === 'productos' && <>
          {usuario?.rol === 'Dueño' && <button className="stock-primario" onClick={abrirNuevoProducto} disabled={guardando}>Nuevo producto</button>}
          {nuevoProducto && usuario?.rol === 'Dueño' && <section className="stock-panel">
            <h2>Nuevo producto</h2>
            <form className="stock-form" onSubmit={e => guardarAlta(e, 'producto')}>
              {[['codigo', 'Código', 50], ['nombre', 'Nombre', 150], ['marca', 'Marca', 100]].map(([campo, etiqueta, max]) => <label key={campo}>{etiqueta}<input maxLength={max} required={campo === 'codigo' || campo === 'nombre'} value={nuevoProducto[campo]} onChange={e => setNuevoProducto(p => ({ ...p, [campo]: e.target.value }))} /></label>)}
              <label className="stock-form-ancho">Descripción<textarea rows="3" maxLength="16000" value={nuevoProducto.descripcion} onChange={e => setNuevoProducto(p => ({ ...p, descripcion: e.target.value }))} /></label>
              <label>Categoría<select required value={nuevoProducto.categoria_id} onChange={e => setNuevoProducto(p => ({ ...p, categoria_id: e.target.value }))}><option value="">Seleccionar categoría</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
              {[['precio_compra', 'Precio de compra'], ['precio_venta', 'Precio de venta'], ['stock_minimo', 'Stock mínimo']].map(([campo, etiqueta]) => <label key={campo}>{etiqueta}<input type="number" min="0" max="99999999.99" step={campo === 'stock_minimo' ? '1' : '0.01'} required value={nuevoProducto[campo]} onChange={e => setNuevoProducto(p => ({ ...p, [campo]: e.target.value }))} /></label>)}
              <button className="stock-primario" disabled={guardando}>{guardando ? 'Guardando...' : 'Crear producto'}</button><button type="button" disabled={guardando} onClick={() => setNuevoProducto(null)}>Cancelar</button>
            </form>
          </section>}
          <section className="products-section"><div className="section-header"><h2>Productos</h2><span>{productos.length} registrados</span></div>
            <div className="products-table-container"><table className="products-table"><thead><tr>
              <th>Código</th><th>Producto</th><th>Marca</th><th>Categoría</th><th>Precio venta</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th><th>Acción</th>
            </tr></thead><tbody>{productos.map(p => <tr key={p.id}>
              <td>{p.codigo}</td><td>{p.nombre}</td><td>{p.marca || '-'}</td><td>{p.categoria || '-'}</td>
              <td>${Number(p.precio_venta || 0).toLocaleString('es-AR')}</td><td>{p.stock_actual ?? 0}</td>
              <td>{p.stock_minimo}</td><td>{p.estado}</td>
              <td><button className="detail-button" onClick={() => verDetalleProducto(p)}>Ver detalle</button></td>
            </tr>)}</tbody></table></div>
          </section>
          {productoSeleccionado && <section className="product-detail stock-panel">
            <div className="detail-header"><div><h2>{productoSeleccionado.nombre}</h2><p>Código: {productoSeleccionado.codigo}</p></div>
              <button className="close-detail-button" onClick={() => { setProductoSeleccionado(null); setLotes([]); }}>Cerrar</button></div>
            <div className="detail-info">
              <div className="detail-card"><span>Stock actual</span><strong>{productoSeleccionado.stock_actual ?? 0}</strong></div>
              <div className="detail-card"><span>Stock mínimo</span><strong>{productoSeleccionado.stock_minimo}</strong></div>
              <div className="detail-card"><span>Estado</span><strong>{productoSeleccionado.estado}</strong></div>
            </div>
            <h3>Lotes</h3>
            {usuario?.rol === 'Dueño' && <button className="stock-primario" disabled={guardando} onClick={() => setNuevoLote({ ...loteInicial })}>Crear lote</button>}
            {nuevoLote && usuario?.rol === 'Dueño' && <form className="stock-form" onSubmit={e => guardarAlta(e, 'lote')}>
              {camposLote(nuevoLote, setNuevoLote)}
              <p className="stock-ayuda stock-form-ancho">El lote se crea con stock cero. Registrá una entrada para incorporar mercadería.</p>
              <button className="stock-primario" disabled={guardando}>{guardando ? 'Guardando...' : 'Crear lote'}</button><button type="button" disabled={guardando} onClick={() => setNuevoLote(null)}>Cancelar</button>
            </form>}
            {cargandoDetalle ? <p>Cargando lotes...</p> : lotes.length === 0 ? <p>Este producto no tiene lotes registrados.</p> :
              <div className="lots-table-container"><table className="lots-table"><thead><tr><th>Lote</th><th>Vencimiento</th><th>Cantidad</th><th>Estado</th></tr></thead>
                <tbody>{lotes.map(l => <tr key={l.id}><td>{l.codigo_lote || '-'}</td><td>{fechaCorta(l.fecha_vencimiento)}</td><td>{l.stock_actual ?? 0}</td><td>{l.estado || '-'}</td></tr>)}</tbody>
              </table></div>}
          </section>}
        </>}
        {seccion === 'registrar' && puedeRegistrarMovimientos(usuario?.rol) && <section className="stock-panel">
          <h2>Registrar movimiento de stock</h2><p className="stock-ayuda">Las salidas descuentan unidades por FEFO automáticamente.</p>
          <div className="stock-tabs"><button className={tipoMovimiento === 'ENTRADA' ? 'activo' : ''} onClick={() => cambiarTipoMovimiento('ENTRADA')}>Entrada</button>
            <button className={tipoMovimiento === 'SALIDA' ? 'activo' : ''} onClick={() => cambiarTipoMovimiento('SALIDA')}>Salida</button></div>
          <form className="stock-form" onSubmit={registrarMovimiento}>
            <label>Producto<select value={formulario.producto_id} onChange={e => cambiarProductoMovimiento(e.target.value)} required>
              <option value="">Seleccionar producto</option>{productos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre} (stock: {p.stock_actual ?? 0})</option>)}
            </select></label>
            {tipoMovimiento === 'ENTRADA' && <label>Modalidad de lote<select value={modalidadLote} onChange={e => { setModalidadLote(e.target.value); setFormulario(f => ({ ...f, lote_id: '' })); }}><option value="existente">Usar lote existente</option><option value="nuevo">Crear lote nuevo con esta entrada</option></select></label>}
            {tipoMovimiento === 'ENTRADA' && modalidadLote === 'nuevo' && camposLote(loteEntrada, setLoteEntrada)}
            {tipoMovimiento === 'ENTRADA' && modalidadLote === 'existente' && <label>Lote<select value={formulario.lote_id} onChange={e => setFormulario(f => ({ ...f, lote_id: e.target.value }))} required disabled={!formulario.producto_id || cargandoLotes}>
              <option value="">{cargandoLotes ? 'Cargando lotes...' : 'Seleccionar lote existente'}</option>
              {lotesFormulario.map(l => <option key={l.id} value={l.id}>{l.codigo_lote} — stock: {l.stock_actual ?? 0} — vence: {fechaCorta(l.fecha_vencimiento)}</option>)}
            </select>{formulario.producto_id && !cargandoLotes && lotesFormulario.length === 0 && <small>Este producto no tiene lotes activos. Elegí la modalidad de lote nuevo para crearlo con esta entrada.</small>}</label>}
            {formulario.producto_id && <p className="stock-ayuda stock-form-ancho" role="status">Stock disponible: {stockDisponible ?? 'No disponible'}. El servidor verifica el stock al registrar la operación.</p>}
            {avisoSalida && <p className="stock-ayuda stock-form-ancho" role="status">{avisoSalida}</p>}
            <label>Cantidad<input type="number" min="1" step="1" required value={formulario.cantidad} onChange={e => setFormulario(f => ({ ...f, cantidad: e.target.value }))} /></label>
            <label>Motivo<input type="text" list="stock-motivos-sugeridos" maxLength="100" required placeholder={tipoMovimiento === 'ENTRADA' ? 'Compra / reposición' : 'Venta / merma'} value={formulario.motivo} onChange={e => setFormulario(f => ({ ...f, motivo: e.target.value }))} /></label>
            <datalist id="stock-motivos-sugeridos">{MOTIVOS_MOVIMIENTO[tipoMovimiento].map(motivo => <option key={motivo} value={motivo} />)}</datalist>
            <label className="stock-form-ancho">Observación (opcional)<textarea rows="3" maxLength="255" value={formulario.observacion} onChange={e => setFormulario(f => ({ ...f, observacion: e.target.value }))} /></label>
            <button className="stock-primario" type="submit" disabled={guardando || cargandoLotes}>{guardando ? 'Registrando...' : `Registrar ${tipoMovimiento === 'ENTRADA' ? 'entrada' : 'salida'}`}</button>
          </form>
        </section>}
        {seccion === 'movimientos' && <section className="stock-panel">
          <div className="section-header"><h2>Historial de movimientos</h2><span>{historial.total} registros</span></div>
          <form className="stock-filtros" onSubmit={aplicarFiltros}>
            <label>Tipo<select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}><option value="">Todos</option><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option></select></label>
            <label>Producto<select value={filtros.producto_id} onChange={e => setFiltros(f => ({ ...f, producto_id: e.target.value }))}><option value="">Todos</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
            <label>Desde<input type="date" value={filtros.fecha_desde} onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} /></label>
            <label>Hasta<input type="date" value={filtros.fecha_hasta} onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} /></label>
            <button className="stock-primario" type="submit">Buscar</button>
            <button type="button" onClick={() => { setFiltros(filtrosIniciales); setFiltrosAplicados(filtrosIniciales); cargarHistorial(1, filtrosIniciales); }}>Limpiar</button>
          </form>
          {cargandoHistorial ? <p>Cargando movimientos...</p> : historial.movimientos.length === 0 ? <p>No hay movimientos para estos filtros.</p> :
            <div className="stock-tabla-scroll"><table className="products-table"><thead><tr><th>Fecha</th><th>Código</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Observación</th><th>Responsable</th><th>Acción</th></tr></thead>
              <tbody>{historial.movimientos.map(m => <tr key={m.id}><td>{fechaCompleta(m.fecha)}</td><td>{m.codigo}</td><td>{m.producto}</td>
                <td><span className={`stock-etiqueta ${m.tipo === 'ENTRADA' ? 'entrada' : 'salida'}`}>{m.tipo}</span></td><td>{m.cantidad}</td><td>{m.motivo}</td><td>{m.observacion || '-'}</td><td>{m.usuario_responsable || 'Sin responsable registrado'}</td>
                <td><button className="detail-button" onClick={() => abrirDetalleMovimiento(m.id)}>Ver lotes</button></td></tr>)}</tbody>
            </table></div>}
          <div className="stock-paginacion"><button disabled={pagina <= 1 || cargandoHistorial} onClick={() => cargarHistorial(pagina - 1)}>Anterior</button>
            <span>Página {pagina} de {Math.max(historial.total_paginas, 1)}</span>
            <button disabled={pagina >= historial.total_paginas || cargandoHistorial} onClick={() => cargarHistorial(pagina + 1)}>Siguiente</button></div>
          {detalleMovimiento && <div className="stock-detalle-movimiento"><div className="section-header"><h3>Movimiento #{detalleMovimiento.movimiento.id}</h3><button onClick={() => setDetalleMovimiento(null)}>Cerrar</button></div>
            <p>Responsable: {detalleMovimiento.movimiento.usuario_responsable || 'Sin responsable registrado'}</p><p>{detalleMovimiento.movimiento.producto} · {detalleMovimiento.movimiento.tipo} · {detalleMovimiento.movimiento.cantidad} unidades</p>
            <div className="stock-tabla-scroll"><table className="products-table"><thead><tr><th>Lote</th><th>Vencimiento</th><th>Cantidad</th></tr></thead>
              <tbody>{detalleMovimiento.lotes.map(l => <tr key={l.lote_id}><td>{l.codigo_lote}</td><td>{fechaCorta(l.fecha_vencimiento)}</td><td>{l.cantidad}</td></tr>)}</tbody></table></div>
          </div>}
        </section>}
      </main>
    </div>
  );
}
export default App;
