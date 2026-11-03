import { useEffect, useState } from 'react';
import { descripcionesRoles } from './permisos.js';

const filtrosIniciales = { busqueda: '', rol: '', activo: '' };
export default function Usuarios({ token, apiUrl, solicitarApi, usuarioActual, onUsuarioActualizado }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [aplicados, setAplicados] = useState(filtrosIniciales);
  const [recarga, setRecarga] = useState(0);
  const [formulario, setFormulario] = useState(null);
  const [original, setOriginal] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function solicitar(ruta, opciones = {}) {
    return solicitarApi(`/usuarios${ruta}`, opciones);
  }
  useEffect(() => {
    const controller = new AbortController();
    async function cargar() {
      try {
        const [lista, opciones] = await Promise.all([
          solicitar(`?${new URLSearchParams(aplicados)}`, { signal: controller.signal }),
          solicitar('/roles', { signal: controller.signal })
        ]);
        if (!controller.signal.aborted) { setUsuarios(lista); setRoles(opciones); }
      } catch (e) { if (!controller.signal.aborted) { setUsuarios([]); setError(e.message); } }
      finally { if (!controller.signal.aborted) setCargando(false); }
    }
    cargar();
    return () => controller.abort();
    // Apply only submitted filters and explicit refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl, solicitarApi, aplicados, recarga]);

  function editar(usuario) {
    setError(''); setMensaje(''); setOriginal(usuario);
    setFormulario({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, activo: Boolean(usuario.activo) });
  }
  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) return;
    const creando = !formulario.id;
    if (creando && new TextEncoder().encode(formulario.contrasena).length > 72) { setError('La contraseña no puede superar 72 bytes.'); return; }
    const sensible = creando || original.rol !== formulario.rol || Boolean(original.activo) !== formulario.activo;
    if (sensible && !window.confirm(creando ? `¿Crear la cuenta de ${formulario.nombre} con rol ${formulario.rol}?` : `¿Confirmás el cambio de rol o estado de ${formulario.nombre}? ${formulario.activo ? 'La cuenta quedará activa.' : 'La cuenta perderá el acceso al sistema.'}`)) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const datos = await solicitar(creando ? '' : `/${formulario.id}`, { method: creando ? 'POST' : 'PUT', body: JSON.stringify(formulario) });
      if (Number(datos.usuario.id) === Number(usuarioActual.id)) onUsuarioActualizado(datos.usuario);
      setFormulario(null); setOriginal(null); setMensaje(datos.mensaje);
      setCargando(true); setRecarga(n => n + 1);
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  }
  const propio = formulario?.id === usuarioActual.id;
  return <section className="stock-panel" aria-busy={cargando || guardando}>
    <h2>Administración de usuarios</h2>
    <p className="stock-ayuda">Solo Dueño puede administrar cuentas. No podés desactivar tu cuenta ni quitarte el acceso administrativo. Desactivar una cuenta invalida su acceso con tokens existentes.</p>
    <div className="stock-tabs">
      <button disabled={guardando || cargando || !roles.length} onClick={() => { setOriginal(null); setFormulario({ nombre: '', email: '', rol: roles.includes('Dueño') ? 'Dueño' : roles[0], activo: true, contrasena: '' }); setError(''); setMensaje(''); }}>Nuevo usuario</button>
      <button disabled={guardando || cargando} onClick={() => { setCargando(true); setError(''); setRecarga(n => n + 1); }}>Actualizar usuarios</button>
    </div>
    {error && <div className="error-message" role="alert">{error}</div>}
    {mensaje && <div className="stock-exito" role="status">{mensaje}</div>}
    {formulario && <form className="stock-form" onSubmit={guardar}>
      <h3 className="stock-form-ancho">{formulario.id ? 'Editar usuario' : 'Nuevo usuario'}</h3>
      <label>Nombre<input required maxLength="100" autoComplete="off" disabled={guardando} value={formulario.nombre} onChange={e => setFormulario(f => ({ ...f, nombre: e.target.value }))} /></label>
      <label>Correo<input type="email" required maxLength="150" autoComplete="off" disabled={guardando} value={formulario.email} onChange={e => setFormulario(f => ({ ...f, email: e.target.value }))} /></label>
      <label>Rol<select required disabled={guardando || propio} value={formulario.rol} onChange={e => setFormulario(f => ({ ...f, rol: e.target.value }))}>{roles.map(rol => <option key={rol} value={rol}>{rol}</option>)}</select></label>
      <p className="stock-ayuda">{descripcionesRoles[formulario.rol]}</p>
      <label>Estado<select disabled={guardando || propio} value={String(formulario.activo)} onChange={e => setFormulario(f => ({ ...f, activo: e.target.value === 'true' }))}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
      {!formulario.id && <label>Contraseña inicial<input type="password" required minLength="8" maxLength="72" autoComplete="new-password" disabled={guardando} value={formulario.contrasena} onChange={e => setFormulario(f => ({ ...f, contrasena: e.target.value }))} /><small>Al menos 8 caracteres y hasta 72 bytes.</small></label>}
      <div className="stock-tabs stock-form-ancho"><button className="stock-primario" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar usuario'}</button><button type="button" disabled={guardando} onClick={() => { setFormulario(null); setOriginal(null); }}>Cancelar</button></div>
    </form>}
    <form className="stock-form" onSubmit={e => { e.preventDefault(); setError(''); setCargando(true); setAplicados({ ...filtros }); }}>
      <label>Buscar por nombre o correo<input maxLength="150" value={filtros.busqueda} onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))} /></label>
      <label>Rol<select value={filtros.rol} onChange={e => setFiltros(f => ({ ...f, rol: e.target.value }))}><option value="">Todos</option>{roles.map(rol => <option key={rol} value={rol}>{rol}</option>)}</select></label>
      <label>Estado<select value={filtros.activo} onChange={e => setFiltros(f => ({ ...f, activo: e.target.value }))}><option value="">Todos</option><option value="1">Activos</option><option value="0">Inactivos</option></select></label>
      <button className="stock-primario" disabled={cargando || guardando}>Buscar</button>
    </form>
    {cargando ? <p role="status">Cargando usuarios...</p> : usuarios.length === 0 ? <p>No hay usuarios para los filtros aplicados.</p> : <>
      <p className="stock-ayuda">{usuarios.length} cuentas encontradas</p>
      <div className="stock-tabla-scroll"><table className="products-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{usuarios.map(u => <tr key={u.id}><td>{u.nombre}{u.id === usuarioActual.id && ' (tu cuenta)'}</td><td>{u.email}</td><td><span className="stock-etiqueta entrada">{u.rol}</span></td><td><span className={`stock-etiqueta ${u.activo ? 'entrada' : 'salida'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td><td><button className="detail-button" disabled={guardando} onClick={() => editar(u)}>Editar</button></td></tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
