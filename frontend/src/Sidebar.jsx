import { useRef, useState } from 'react';
import './Sidebar.css';
import { puedeRegistrarMovimientos } from './permisos.js';

const iconos = {
  panel: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  productos: <><path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5" /></>,
  nuevo: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  movimientos: <><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></>,
  registrar: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15h6" /></>,
  alertas: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  reportes: <><path d="M4 3v18h17M8 16v-4M13 16V7M18 16v-7" /></>,
  usuarios: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5" /></>,
  actualizar: <><path d="M20 7a9 9 0 0 0-15-2L3 8m0-5v5h5M4 17a9 9 0 0 0 15 2l2-3m0 5v-5h-5" /></>,
  salir: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M9 12h12m-4-4 4 4-4 4" /></>
};
function Icono({ nombre }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconos[nombre]}</svg>;
}

export default function Sidebar({ seccion, nuevoProductoAbierto, usuario, guardando, onNavegar, onNuevoProducto, onActualizar, onCerrarSesion }) {
  const [abierta, setAbierta] = useState(false);
  const botonMenu = useRef(null);
  const opciones = [
    ['panel', 'Panel', 'panel'],
    ['productos', 'Productos', 'productos'],
    ...(usuario?.rol === 'Dueño' ? [['nuevo', 'Nuevo producto', 'nuevo']] : []),
    ['movimientos', 'Movimientos', 'movimientos'],
    ...(puedeRegistrarMovimientos(usuario?.rol) ? [['registrar', 'Registrar movimiento', 'registrar']] : []),
    ['alertas', 'Alertas', 'alertas'],
    ['reportes', 'Reportes', 'reportes'],
    ...(usuario?.rol === 'Dueño' ? [['usuarios', 'Usuarios', 'usuarios']] : [])
  ];
  function cerrarMenu() {
    setAbierta(false);
    if (abierta) botonMenu.current?.focus();
  }
  return <aside className={`sf-sidebar ${abierta ? 'sf-sidebar-abierta' : ''}`} onKeyDown={e => { if (e.key === 'Escape') cerrarMenu(); }}>
    <div className="sf-sidebar-cabecera">
      <div className="sf-sidebar-marca"><span className="sf-sidebar-logo"><Icono nombre="productos" /></span><div><strong>Stock Fiable</strong><span>Gestión de inventario</span></div></div>
      <button ref={botonMenu} type="button" className="sf-sidebar-toggle" aria-label={abierta ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierta} aria-controls="sf-sidebar-contenido" onClick={() => setAbierta(v => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={abierta ? 'M6 6l12 12M6 18 18 6' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
      </button>
    </div>
    <div id="sf-sidebar-contenido" className="sf-sidebar-contenido">
      <nav aria-label="Navegación principal" className="sf-sidebar-nav">
        <p className="sf-sidebar-etiqueta">ESPACIO DE TRABAJO</p>
        {opciones.map(([id, titulo, icono]) => {
          const activa = id === 'nuevo' ? seccion === 'productos' && nuevoProductoAbierto : seccion === id && !(id === 'productos' && nuevoProductoAbierto);
          return <button key={id} type="button" className={`sf-sidebar-boton ${activa ? 'sf-sidebar-activa' : ''}`} aria-current={activa ? 'page' : undefined} disabled={id === 'nuevo' && guardando} onClick={() => { if (id === 'nuevo') onNuevoProducto(); else onNavegar(id); cerrarMenu(); }}><Icono nombre={icono} /><span>{titulo}</span>{activa && <span className="sf-sidebar-punto" />}</button>;
        })}
        <div className="sf-sidebar-herramientas"><button type="button" className="sf-sidebar-boton" disabled={guardando} onClick={() => { onActualizar(); cerrarMenu(); }}><Icono nombre="actualizar" /><span>Actualizar inventario</span></button></div>
      </nav>
      <div className="sf-sidebar-pie">
        <div className="sf-sidebar-usuario"><span className="sf-sidebar-avatar" aria-hidden="true">{usuario?.nombre?.slice(0, 1).toUpperCase() || 'U'}</span><div><strong>{usuario?.nombre}</strong><span>{usuario?.rol}</span></div></div>
        <button type="button" className="sf-sidebar-boton sf-sidebar-salir" onClick={onCerrarSesion}><Icono nombre="salir" /><span>Cerrar sesión</span></button>
      </div>
    </div>
  </aside>;
}
