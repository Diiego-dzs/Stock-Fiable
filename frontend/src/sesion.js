export const CLAVE_SESION = 'stock-fiable-token';
const obsoleta = () => new DOMException('La sesión cambió', 'AbortError');

export function crearSesion({ apiUrl, fetchApi = (...args) => fetch(...args), storage, ventana, documento, ahora = Date.now }) {
  let tokenGuardado = null;
  try { tokenGuardado = storage?.getItem(CLAVE_SESION) || null; } catch { /* Storage may be unavailable. */ }
  let estado = { token: tokenGuardado, usuario: null, estado: tokenGuardado ? 'verificando' : 'sinSesion', error: '' };
  let generacion = 0, pendiente = null, ultimaRevision = -Infinity;
  let controller = new AbortController(), iniciada = false;
  const escuchas = new Set();
  const publicar = cambios => { estado = { ...estado, ...cambios }; escuchas.forEach(fn => fn()); };
  function guardarToken(token) {
    try { if (token) storage?.setItem(CLAVE_SESION, token); else storage?.removeItem(CLAVE_SESION); } catch { /* Keep the memory session usable. */ }
  }
  function cerrar() {
    generacion++; controller.abort(); controller = new AbortController(); pendiente = null;
    ultimaRevision = -Infinity; guardarToken(null);
    publicar({ token: null, usuario: null, estado: 'sinSesion', error: '' });
  }
  function sincronizar({ forzar = false } = {}) {
    if (!estado.token) return Promise.resolve(null);
    if (pendiente) return pendiente;
    if (!forzar && ahora() - ultimaRevision < 1000 && estado.usuario) return Promise.resolve(estado.usuario);
    const revision = generacion, token = estado.token, signal = controller.signal;
    if (!estado.usuario) publicar({ estado: 'verificando', error: '' });
    const tarea = (async () => {
      try {
        const respuesta = await Promise.resolve().then(() => {
          if (revision !== generacion) throw obsoleta();
          return fetchApi(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
        });
        if (revision !== generacion) throw obsoleta();
        if (respuesta.status === 401 || respuesta.status === 403) { cerrar(); return null; }
        if (!respuesta.ok) throw new Error('No se pudo verificar la sesión. Intentá nuevamente.');
        const datos = await respuesta.json();
        if (revision !== generacion) throw obsoleta();
        if (!datos.usuario?.activo) { cerrar(); return null; }
        ultimaRevision = ahora();
        publicar({ usuario: datos.usuario, estado: 'lista', error: '' });
        return datos.usuario;
      } catch (error) {
        if (revision !== generacion || error.name === 'AbortError') return null;
        publicar({ estado: estado.usuario ? 'lista' : 'error', error: 'No se pudo verificar la sesión. Revisá la conexión y reintentá.' });
        return null;
      } finally { if (revision === generacion) pendiente = null; }
    })();
    pendiente = tarea;
    return tarea;
  }
  async function establecer(token) {
    generacion++; controller.abort(); controller = new AbortController(); pendiente = null;
    ultimaRevision = -Infinity; guardarToken(token);
    publicar({ token, usuario: null, estado: 'verificando', error: '' });
    return sincronizar({ forzar: true });
  }
  async function solicitar(ruta, opciones = {}, tokenActual = estado.token) {
    const revision = generacion;
    if (!tokenActual || tokenActual !== estado.token) throw obsoleta();
    const signal = opciones.signal ? AbortSignal.any([opciones.signal, controller.signal]) : controller.signal;
    const respuesta = await fetchApi(`${apiUrl}${ruta}`, { ...opciones, signal, headers: { ...opciones.headers, Authorization: `Bearer ${tokenActual}`, ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (revision !== generacion) throw obsoleta();
    if (respuesta.status === 401) { cerrar(); throw obsoleta(); }
    if (respuesta.status === 403) await sincronizar({ forzar: true });
    if (revision !== generacion) throw obsoleta();
    const datos = await respuesta.json();
    if (revision !== generacion) throw obsoleta();
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la operación');
    return datos;
  }
  function enfocar() { if (documento?.visibilityState !== 'hidden') void sincronizar({ forzar: true }); }
  function iniciar() {
    if (iniciada) return;
    iniciada = true;
    ventana?.addEventListener('focus', enfocar);
    documento?.addEventListener('visibilitychange', enfocar);
    void sincronizar();
  }
  function detener() {
    iniciada = false;
    ventana?.removeEventListener('focus', enfocar);
    documento?.removeEventListener('visibilitychange', enfocar);
    // StrictMode may immediately reconnect: reuse the pending verification in that case.
    queueMicrotask(() => { if (!iniciada) { generacion++; controller.abort(); controller = new AbortController(); pendiente = null; } });
  }
  return { getSnapshot: () => estado, subscribe: fn => { escuchas.add(fn); return () => escuchas.delete(fn); }, iniciar, detener, cerrar, establecer, sincronizar, solicitar };
}
