const { test } = require('node:test');
const assert = require('node:assert/strict');

function almacenamiento(inicial = {}) {
  const valores = new Map(Object.entries(inicial));
  return { getItem: k => valores.get(k) ?? null, setItem: (k, v) => valores.set(k, v), removeItem: k => valores.delete(k), valores };
}
function respuesta(status, usuario) { return { status, ok: status >= 200 && status < 300, json: async () => ({ usuario, error: 'Sin permiso' }) }; }
const perfil = rol => ({ id: 1, nombre: 'Cuenta de prueba', email: 'prueba@example.test', rol, activo: true });
function diferida() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('sincronización y recuperación de sesión en frontend', async t => {
  const { crearSesion, CLAVE_SESION } = await import('../frontend/src/sesion.js');
  await t.test('sin token guardado no realiza solicitudes', async () => {
    const s = crearSesion({ apiUrl: '/api', storage: almacenamiento(), fetchApi: () => assert.fail('no debería consultar') });
    s.iniciar(); await s.sincronizar();
    assert.equal(s.getSnapshot().estado, 'sinSesion'); s.detener();
  });
  await t.test('recupera solo el token y valida perfil antes de habilitar la aplicación', async () => {
    const storage = almacenamiento({ [CLAVE_SESION]: 'token-prueba' });
    const espera = diferida();
    const s = crearSesion({ apiUrl: '/api', storage, fetchApi: (url, options) => {
      assert.equal(url, '/api/auth/me'); assert.equal(options.headers.Authorization, 'Bearer token-prueba');
      return espera.promise;
    } });
    assert.equal(s.getSnapshot().estado, 'verificando'); assert.equal(s.getSnapshot().usuario, null);
    const tarea = s.sincronizar(); espera.resolve(respuesta(200, perfil('Consulta'))); await tarea;
    assert.equal(s.getSnapshot().usuario.rol, 'Consulta'); assert.equal(s.getSnapshot().estado, 'lista');
    assert.deepEqual([...storage.valores.keys()], [CLAVE_SESION]);
  });
  await t.test('iniciar sesión consulta el perfil vigente y notifica cambios de rol', async () => {
    let rol = 'Dueño', notificaciones = 0;
    const storage = almacenamiento();
    const s = crearSesion({ apiUrl: '/api', storage, fetchApi: async () => respuesta(200, perfil(rol)) });
    const quitar = s.subscribe(() => notificaciones++);
    await s.establecer('token-prueba'); rol = 'Empleado'; await s.sincronizar({ forzar: true });
    assert.equal(s.getSnapshot().usuario.rol, 'Empleado');
    rol = 'Consulta'; await s.sincronizar({ forzar: true });
    assert.equal(s.getSnapshot().usuario.rol, 'Consulta'); assert.ok(notificaciones >= 4);
    quitar(); s.cerrar(); assert.equal(storage.getItem(CLAVE_SESION), null);
  });
  await t.test('desactivación y token inválido eliminan sesión recuperada o existente', async () => {
    for (const status of [401, 403, 200]) {
      const storage = almacenamiento({ [CLAVE_SESION]: 'invalido' });
      const s = crearSesion({ apiUrl: '/api', storage, fetchApi: async () => respuesta(status, { ...perfil('Dueño'), activo: false }) });
      await s.sincronizar();
      assert.equal(s.getSnapshot().token, null); assert.equal(s.getSnapshot().usuario, null);
      assert.equal(storage.getItem(CLAVE_SESION), null);
    }
  });
  await t.test('focus y visibilidad comparten solicitud y no agregan listeners duplicados', async () => {
    const ventana = new EventTarget(), documento = new EventTarget(); documento.visibilityState = 'visible';
    let llamadas = 0, reloj = 0, espera = null;
    const s = crearSesion({ apiUrl: '/api', storage: almacenamiento({ [CLAVE_SESION]: 'token' }), ventana, documento, ahora: () => reloj,
      fetchApi: async () => { llamadas++; return espera ? espera.promise : respuesta(200, perfil('Dueño')); } });
    s.iniciar(); s.detener(); s.iniciar(); await s.sincronizar();
    assert.equal(llamadas, 1);
    espera = diferida(); reloj = 2000;
    ventana.dispatchEvent(new Event('focus')); documento.dispatchEvent(new Event('visibilitychange'));
    const tarea = s.sincronizar();
    await Promise.resolve(); assert.equal(llamadas, 2);
    espera.resolve(respuesta(200, perfil('Consulta'))); await tarea;
    assert.equal(s.getSnapshot().usuario.rol, 'Consulta');
    documento.visibilityState = 'hidden'; reloj = 4000; documento.dispatchEvent(new Event('visibilitychange'));
    assert.equal(llamadas, 2);
    s.detener(); await Promise.resolve(); ventana.dispatchEvent(new Event('focus')); assert.equal(llamadas, 2);
  });
  await t.test('respuestas tardías no restauran permisos después de cerrar o cambiar de sesión', async () => {
    const espera = diferida();
    const s = crearSesion({ apiUrl: '/api', fetchApi: async (url, options) => options.headers.Authorization === 'Bearer antiguo' ? espera.promise : respuesta(200, perfil('Consulta')) });
    const antigua = s.establecer('antiguo'); await Promise.resolve();
    s.cerrar(); await s.establecer('nuevo');
    espera.resolve(respuesta(200, perfil('Dueño'))); await antigua;
    assert.equal(s.getSnapshot().token, 'nuevo'); assert.equal(s.getSnapshot().usuario.rol, 'Consulta');
  });
  await t.test('401 de cualquier módulo cierra sesión; 403 actualiza los permisos', async () => {
    let estadoApi = 403, rol = 'Dueño';
    const s = crearSesion({ apiUrl: '/api', fetchApi: async url => url.endsWith('/auth/me') ? respuesta(200, perfil(rol)) : respuesta(estadoApi) });
    await s.establecer('token'); rol = 'Consulta';
    await assert.rejects(s.solicitar('/usuarios'), /Sin permiso/);
    assert.equal(s.getSnapshot().usuario.rol, 'Consulta');
    estadoApi = 401; await assert.rejects(s.solicitar('/productos'), e => e.name === 'AbortError');
    assert.equal(s.getSnapshot().estado, 'sinSesion');
  });
  await t.test('un 401 tardío de otra sesión no cierra la sesión nueva', async () => {
    const espera = diferida();
    const s = crearSesion({ apiUrl: '/api', fetchApi: async url => url.endsWith('/auth/me') ? respuesta(200, perfil('Consulta')) : espera.promise });
    await s.establecer('viejo'); const peticion = s.solicitar('/productos');
    await s.establecer('nuevo'); espera.resolve(respuesta(401));
    await assert.rejects(peticion, e => e.name === 'AbortError'); assert.equal(s.getSnapshot().token, 'nuevo');
  });
  await t.test('fallos temporales conservan token y permiten reintentar la recuperación', async () => {
    let fallo = true;
    const storage = almacenamiento({ [CLAVE_SESION]: 'token' });
    const s = crearSesion({ apiUrl: '/api', storage, fetchApi: () => { if (fallo) throw new Error('offline'); return Promise.resolve(respuesta(200, perfil('Empleado'))); } });
    await s.sincronizar(); assert.equal(s.getSnapshot().estado, 'error'); assert.equal(storage.getItem(CLAVE_SESION), 'token');
    fallo = false; await s.sincronizar({ forzar: true }); assert.equal(s.getSnapshot().estado, 'lista');
  });
});
