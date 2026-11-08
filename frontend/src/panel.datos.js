const rutas = { movimientos: '/movimientos?page=1&limite=5', vencimientos: '/stock/alertas-vencimiento' };
const inicial = () => ({ datos: null, cargando: false, error: '' });
// Two session-scoped resources. Pending requests and obsolete generations are isolated.
export function crearDatosPanel(solicitar) {
 let estado = { movimientos: inicial(), vencimientos: inicial() };
 const escuchas = new Set(); const pendientes = new Map(); let revision = 0;
 function publicar(clave, valor) { estado = { ...estado, [clave]: valor }; escuchas.forEach(fn => fn()); }
 function cargar(clave) {
  if (pendientes.has(clave)) return pendientes.get(clave).promesa;
  if (estado[clave].datos !== null) return Promise.resolve(estado[clave].datos);
  const generacion = revision; const controller = new AbortController();
  publicar(clave, { ...inicial(), cargando: true });
  const promesa = Promise.resolve().then(() => solicitar(rutas[clave], { signal: controller.signal })).then(datos => {
   if (generacion !== revision || controller.signal.aborted) throw new DOMException('Datos obsoletos', 'AbortError');
   publicar(clave, { datos, cargando: false, error: '' }); return datos;
  }).catch(error => {
   if (generacion === revision && !controller.signal.aborted) publicar(clave, { ...inicial(), error: error.name === 'AbortError' ? '' : error.message });
   throw error;
  }).finally(() => { if (pendientes.get(clave)?.promesa === promesa) pendientes.delete(clave); });
  pendientes.set(clave, { promesa, controller }); return promesa;
 }
 function invalidar() {
  revision++; pendientes.forEach(p => p.controller.abort()); pendientes.clear();
  estado = { movimientos: inicial(), vencimientos: inicial() }; escuchas.forEach(fn => fn());
 }
 return { cargar, invalidar, getSnapshot: () => estado, subscribe: fn => { escuchas.add(fn); return () => escuchas.delete(fn); } };
}
