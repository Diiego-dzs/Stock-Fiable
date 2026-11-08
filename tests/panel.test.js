const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const utils = () => import('../frontend/src/panel.utils.js');
const store = () => import('../frontend/src/panel.datos.js');
const resumen = { total_productos: 3, unidades_totales: 10, productos_stock_normal: 1, productos_stock_bajo: 1, productos_sin_stock: 1 };

test('Panel: distribución corresponde al resumen y maneja inventario vacío', async () => {
 const { distribucionStock, alertasProductos } = await utils();
 const filas=distribucionStock(resumen); assert.deepEqual(filas.map(f => f.cantidad),[1,1,1]);
 assert.equal(filas.reduce((r,f) => r+f.cantidad,0),resumen.total_productos);
 assert.ok(Math.abs(filas.reduce((r,f) => r+f.porcentaje,0)-100)<0.0001);
 assert.ok(distribucionStock(null).every(f => f.cantidad===0 && f.porcentaje===0));
 const productos=[{id:1,estado:'activo',stock_actual:0,stock_minimo:2},{id:2,estado:'activo',stock_actual:2,stock_minimo:2},{id:3,estado:'activo',stock_actual:8,stock_minimo:2},{id:4,estado:'inactivo',stock_actual:0,stock_minimo:2}];
 assert.deepEqual(alertasProductos(productos).map(p => p.alerta),['SIN_STOCK','STOCK_BAJO']);
 assert.deepEqual(alertasProductos([]),[]);
});

test('Panel: deduplica solicitudes, conserva datos entre secciones y respeta respuesta paginada', async () => {
 const { crearDatosPanel }=await store(); const llamadas=[];
 const movimientos={pagina:1,total:22,total_paginas:5,movimientos:[{id:1,producto:'A',tipo:'ENTRADA',cantidad:2,usuario_responsable:'Responsable'}]};
 const datos=crearDatosPanel(async ruta=>{llamadas.push(ruta);return movimientos;});
 const a=datos.cargar('movimientos'),b=datos.cargar('movimientos');assert.equal(a,b);
 assert.equal(await a,movimientos); await datos.cargar('movimientos');
 assert.deepEqual(llamadas,['/movimientos?page=1&limite=5']);assert.equal(datos.getSnapshot().movimientos.datos.total,22);
});

test('Panel: error parcial y reintento no recargan la sección correcta', async () => {
 const { crearDatosPanel }=await store(); let fallar=true; const llamadas=[];
 const datos=crearDatosPanel(async ruta=>{llamadas.push(ruta);if(ruta.includes('movimientos')&&fallar)throw Error('Sin conexión');return [];});
 await Promise.allSettled([datos.cargar('movimientos'),datos.cargar('vencimientos')]);
 assert.equal(datos.getSnapshot().movimientos.error,'Sin conexión');assert.deepEqual(datos.getSnapshot().vencimientos.datos,[]);
 fallar=false;await datos.cargar('movimientos');assert.equal(datos.getSnapshot().movimientos.error,'');
 assert.equal(llamadas.filter(r=>r.includes('vencimiento')).length,1);
});

test('Panel: invalidación cancela peticiones y descarta respuestas obsoletas de otra sesión', async () => {
 const { crearDatosPanel }=await store();const tareas=[];
 const datos=crearDatosPanel((ruta,{signal})=>new Promise(resolve=>tareas.push({resolve,signal})));
 const anterior=datos.cargar('movimientos');const rechazo=assert.rejects(anterior,{name:'AbortError'});await Promise.resolve();
 datos.invalidar();assert.equal(tareas[0].signal.aborted,true);assert.equal(datos.getSnapshot().movimientos.datos,null);
 const nueva=datos.cargar('movimientos');await Promise.resolve();tareas[1].resolve({movimientos:[{id:2}]});await nueva;
 tareas[0].resolve({movimientos:[{id:1}]});await rechazo;
 assert.deepEqual(datos.getSnapshot().movimientos.datos.movimientos,[{id:2}]);
 datos.invalidar();assert.equal(datos.getSnapshot().movimientos.datos,null);
});

test('Panel: vencimientos conserva lotes de productos inactivos y límites actuales', async () => {
 const { agruparAlertas }=await import('../frontend/src/alertas.utils.js');
 const lotes=[-1,0,7,30,31].map(d=>({id:d,dias_restantes:d,producto_estado:'inactivo',alerta:d<0?'VENCIDO':'VENCE_PRONTO'}));
 const grupos=agruparAlertas([],lotes,30);assert.equal(grupos.vencidos.length,1);assert.equal(grupos.proximos.length,3);
});

test('Panel renderiza indicadores, movimientos, vacíos, enlaces contextuales y errores parciales', async t => {
 const { createServer } = await import('../frontend/node_modules/vite/dist/node/index.js');
 const servidor=await createServer({root:path.resolve('frontend'),server:{middlewareMode:true},appType:'custom'});
 t.after(()=>servidor.close());
 const { default: Panel }=await servidor.ssrLoadModule('/src/PanelPrincipal.jsx');
 const React=require('../frontend/node_modules/react');const {renderToStaticMarkup}=require('../frontend/node_modules/react-dom/server');
 const { crearDatosPanel }=await store();
 const datos=crearDatosPanel(async ruta=>ruta.includes('movimientos')?{movimientos:[{id:1,producto_id:1,producto:'Producto prueba',tipo:'ENTRADA',cantidad:2,fecha:'2026-11-07T12:00:00Z',usuario_responsable:'Responsable prueba'}]}:[]);
 await Promise.all([datos.cargar('movimientos'),datos.cargar('vencimientos')]);
 const props={resumen,productos:[],inventario:{cargando:false,error:''},datosPanel:datos,onNavegar(){},onVerProducto(){},onReintentarInventario(){}};
 let html=renderToStaticMarkup(React.createElement(Panel,props));
 for(const texto of ['Productos activos','Unidades disponibles','Lotes vencidos','Responsable prueba','Producto prueba','No hay lotes','Stock normal: 1 productos'])assert.ok(html.includes(texto),texto);
 assert.ok(!html.includes('Accesos rápidos')); assert.ok(!html.includes('Gestión de usuarios')); assert.ok(!html.includes('Registrar entrada o salida'));
 assert.match(html,/Ver historial/); assert.match(html,/Ver alertas/); assert.match(html,/Ver todos/);
 assert.equal((html.match(/class="sf-panel-tarjeta/g) || []).length,7);
 const vacio=crearDatosPanel(async ruta=>ruta.includes('movimientos')?{movimientos:[]}:[]);await Promise.all([vacio.cargar('movimientos'),vacio.cargar('vencimientos')]);
 html=renderToStaticMarkup(React.createElement(Panel,{...props,resumen:{total_productos:0},datosPanel:vacio}));assert.match(html,/No hay productos activos/);assert.match(html,/No hay movimientos registrados/);assert.ok(!html.includes('Accesos rápidos'));
 const parcial=crearDatosPanel(async ruta=>{if(ruta.includes('movimientos'))throw Error('Fallo movimientos');return [];});await Promise.allSettled([parcial.cargar('movimientos'),parcial.cargar('vencimientos')]);
 html=renderToStaticMarkup(React.createElement(Panel,{...props,datosPanel:parcial}));assert.match(html,/Fallo movimientos/);assert.match(html,/Reintentar esta sección/);assert.match(html,/No hay lotes/);
});
