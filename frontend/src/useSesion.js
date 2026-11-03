import { useEffect, useState, useSyncExternalStore } from 'react';
import { crearSesion } from './sesion.js';

export function useSesion(apiUrl) {
  const [sesion] = useState(() => {
    let storage;
    try { storage = window.sessionStorage; } catch { /* Memory-only fallback. */ }
    return crearSesion({ apiUrl, storage, ventana: window, documento: document });
  });
  const estado = useSyncExternalStore(sesion.subscribe, sesion.getSnapshot);
  useEffect(() => { sesion.iniciar(); return sesion.detener; }, [sesion]);
  return { ...estado, cerrar: sesion.cerrar, establecer: sesion.establecer, sincronizar: sesion.sincronizar, solicitar: sesion.solicitar };
}
