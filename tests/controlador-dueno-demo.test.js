const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { ejecutarValidacion, validarInicio, entornoHijo, lanzar, IMAGEN, ETIQUETA } = require('./helpers/controlador-dueno-demo');
const contrato = require('./helpers/demo-esquema.esperado');
const { CATEGORIAS } = require('../scripts/demo/instalar');
const identidad = 'sf_owner_'+'b'.repeat(24), id = 'a'.repeat(64);
const hashSintetico = '$2b$12$'+'a'.repeat(53);
function escenario({ host='npipe:////./pipe/docker_engine', motor='linux', modificar, errorCreate,
    fallarInicio, fallarInstaller, fallarOwner, fallarConexion, fallarCierre, fallarRm, cancelarCreate, cancelarConexion, diferenteDB, diferenteHostname } = {}) {
    let creado=false, running=false, instalado=false, owner=false;
    const controller = new AbortController(), llamadas=[], mensajes=[];
    let cierres=0, consultas=0, aperturas=0;
    const secreto='credencial-simulada-no-imprimir';
    async function docker(args,variables) {
        llamadas.push(args);
        if(args[0]==='context')return JSON.stringify([{Endpoints:{docker:{Host:host}}}]);
        if(args[0]==='info')return motor;
        if(args[0]==='pull')return '';
        if(args[0]==='create') {
            creado=true;assert.equal(variables.MARIADB_DATABASE,'stock_fiable_demo');
            assert.ok(!args.includes(secreto));
            if(errorCreate)throw new Error(secreto);
            if(cancelarCreate)controller.abort();
            return id;
        }
        if(args[0]==='container') {
            assert.ok(creado);assert.ok([id,identidad].includes(args[2]));
            const x={Id:id,Name:'/'+identidad,Config:{Hostname:identidad,Image:IMAGEN,Labels:{[ETIQUETA]:identidad}},
                HostConfig:{Tmpfs:{'/var/lib/mysql':'rw'},Binds:null,PortBindings:{'3306/tcp':[{HostIp:'127.0.0.1',HostPort:''}]}},
                Mounts:[{Type:'tmpfs'}],State:{Running:running,Health:{Status:'healthy'}},
                NetworkSettings:{Ports:{'3306/tcp':[{HostIp:'127.0.0.1',HostPort:'32001'}]}}};
            if(modificar)modificar(x);
            return JSON.stringify([x]);
        }
        if(args[0]==='start'){if(fallarInicio)throw new Error(secreto);running=true;return '';}
        if(args[0]==='stop'){running=false;return '';}
        if(args[0]==='rm'){if(fallarRm)throw new Error(secreto);creado=false;return '';}
        if(args[0]==='ps')return '';
        assert.fail('Comando inesperado');
    }
    const opciones={docker,identidad,password:secreto,rootPassword:secreto,signal:controller.signal,
        verificar:async()=>({valido:true,diferencias:[]}),informar:m=>mensajes.push(m),
        instalar:async(port,pass)=>{assert.equal(port,32001);assert.equal(pass,secreto);if(fallarInstaller)return 1;instalado=true;return 0;},
        dueno:async()=>{if(fallarOwner)return 1;owner=true;return 0;},
        conectar:async opciones=>{
            aperturas++;assert.equal(opciones.host,'127.0.0.1');assert.equal(opciones.port,32001);
            if(fallarConexion)throw new Error(secreto);
            if(cancelarConexion)controller.abort();
            return {query:async sql=>{
                consultas++;
                if(sql.includes('DATABASE()'))return [{db:diferenteDB?'otra':'stock_fiable_demo',hostname:diferenteHostname?'otro':identidad}];
                if(sql==='SHOW FULL TABLES')return instalado?contrato.map(t=>({tabla:t.nombre})):[];
                if(sql.includes('SELECT nombre'))return CATEGORIAS.map(nombre=>({nombre}));
                if(sql.includes('COUNT(*)'))return [{total:owner?1n:0n}];
                if(sql.includes('FROM usuarios ORDER'))return owner?[{id:1,rol:'Dueño',activo:1,contrasena:hashSintetico}]:[];
                assert.fail('Consulta inesperada');
            },end:async()=>{cierres++;if(fallarCierre)throw new Error(secreto);}};
        }};
    return {opciones,llamadas,mensajes,controller,secreto,estado:()=>({creado,running,aperturas,cierres,consultas})};
}

test('controlador requiere autorización, TTY y ninguna variable Docker de redirección',()=>{
    assert.doesNotThrow(()=>validarInicio({},['--ejecutar'],true));
    for(const env of [{DOCKER_HOST:'tcp://otro'},{DOCKER_CONTEXT:'otro'},{DOCKER_TLS_VERIFY:'1'},{DOCKER_CERT_PATH:'otro'}])assert.throws(()=>validarInicio(env,['--ejecutar'],true));
    assert.throws(()=>validarInicio({},[],true));
    assert.throws(()=>validarInicio({},['--ejecutar','--password','x'],true));
    assert.throws(()=>validarInicio({},['--ejecutar'],false));
});

test('entorno de hijos elimina configuración habitual y solo agrega conexión demo sintética',()=>{
    const env=entornoHijo({PATH:'ruta',DB_PASSWORD:'no-usar',DEMO_DB_HOST:'externo',MARIADB_PASSWORD:'no-usar',NODE_OPTIONS:'--require dotenv/config'},32001,'solo-conexion-sintetica');
    assert.equal(env.PATH,'ruta');assert.equal(env.DEMO_DB_HOST,'127.0.0.1');assert.equal(env.DEMO_DB_PASSWORD,'solo-conexion-sintetica');
    assert.ok(!env.DB_PASSWORD&&!env.MARIADB_PASSWORD&&!env.NODE_OPTIONS);
    assert.deepEqual(Object.keys(env).sort(),['PATH','DEMO_DB_HOST','DEMO_DB_PORT','DEMO_DB_NAME','DEMO_DB_USER','DEMO_DB_PASSWORD'].sort());
});

test('rechaza contexto remoto y motor Windows antes de crear recursos',async()=>{
    for(const config of [{host:'tcp://remoto:2375'},{motor:'windows'}]) {
        const e=escenario(config);await assert.rejects(ejecutarValidacion(e.opciones));
        assert.ok(!e.llamadas.some(a=>['create','start'].includes(a[0])));assert.equal(e.estado().aperturas,0);
    }
});

test('ciclo completo simulado verifica esquema, Dueño/costo12, rechazo y limpieza sin secretos',async()=>{
    const e=escenario();const r=await ejecutarValidacion(e.opciones);
    assert.deepEqual(r,{identidad,id,limpio:true});assert.equal(e.estado().aperturas,e.estado().cierres);
    assert.equal(e.estado().creado,false);assert.deepEqual(e.llamadas.find(a=>a[0]==='rm'),['rm',id]);
    assert.ok(!JSON.stringify(e.mensajes).includes(e.secreto));assert.ok(!JSON.stringify(e.mensajes).includes(hashSintetico));
});

test('rechaza identidad, imagen, etiqueta, mounts y nombres ajenos sin eliminar recursos ambiguos',async()=>{
    for(const modificar of [x=>{x.Id='a'.repeat(12);},x=>{x.Name='/otro';},x=>{x.Config.Hostname='otro';},
        x=>{x.Config.Labels[ETIQUETA]='otro';},x=>{x.Config.Image='mariadb:latest';},
        x=>{x.Mounts=[{Type:'volume'}];},x=>{x.HostConfig.Binds=['/otro:/var/lib/mysql'];}]) {
        const e=escenario({modificar});await assert.rejects(ejecutarValidacion(e.opciones),err=>err.revisionManual);
        assert.ok(!e.llamadas.some(a=>['start','stop','rm'].includes(a[0])));assert.equal(e.estado().aperturas,0);
    }
});

test('puertos inválidos, múltiples y exposición externa impiden conexiones',async()=>{
    for(const modificar of [x=>{x.NetworkSettings.Ports['3306/tcp'][0].HostIp='0.0.0.0';},
        x=>{x.NetworkSettings.Ports['3306/tcp'][0].HostPort='0';},
        x=>{x.NetworkSettings.Ports['3306/tcp'][0].HostPort='65536';},
        x=>{x.NetworkSettings.Ports['3306/tcp'].push({HostIp:'127.0.0.1',HostPort:'32002'});}]) {
        const e=escenario({modificar});await assert.rejects(ejecutarValidacion(e.opciones));
        assert.equal(e.estado().aperturas,0);assert.equal(e.estado().creado,false);
    }
});

test('fallo create después de crear recupera nombre exacto y elimina solo ID verificado',async()=>{
    const e=escenario({errorCreate:true});await assert.rejects(ejecutarValidacion(e.opciones));
    assert.ok(e.llamadas.some(a=>a[0]==='container'&&a[2]===identidad));
    assert.deepEqual(e.llamadas.find(a=>a[0]==='rm'),['rm',id]);
});

test('cancelación tras create impide start pero conserva limpieza verificada',async()=>{
    const e=escenario({cancelarCreate:true});await assert.rejects(ejecutarValidacion(e.opciones));
    assert.ok(!e.llamadas.some(a=>a[0]==='start'));assert.equal(e.estado().creado,false);
});

test('adquisición completada después de cancelar cierra sin ejecutar consultas',async()=>{
    const e=escenario({cancelarConexion:true});await assert.rejects(ejecutarValidacion(e.opciones));
    assert.equal(e.estado().consultas,0);assert.equal(e.estado().cierres,1);assert.equal(e.estado().creado,false);
});

test('identidad MariaDB distinta impide instalar y cierra conexión',async()=>{
    for(const config of [{diferenteDB:true},{diferenteHostname:true}]) {
        const e=escenario(config);let instalado=false;e.opciones.instalar=async()=>{instalado=true;return 0;};
        await assert.rejects(ejecutarValidacion(e.opciones));assert.equal(instalado,false);
        assert.equal(e.estado().cierres,1);assert.equal(e.estado().creado,false);
    }
});

test('fallos de start, conexión, instalación y proceso interactivo siempre limpian lo propio',async()=>{
    for(const config of [{fallarInicio:true},{fallarConexion:true},{fallarInstaller:true},{fallarOwner:true}]) {
        const e=escenario(config);await assert.rejects(ejecutarValidacion(e.opciones));assert.equal(e.estado().creado,false);
    }
});

test('discrepancia estructural impide ejecutar el proceso interactivo',async()=>{
    const e=escenario();let ejecutado=false;e.opciones.verificar=async()=>({valido:false});
    e.opciones.dueno=async()=>{ejecutado=true;return 0;};
    await assert.rejects(ejecutarValidacion(e.opciones));assert.equal(ejecutado,false);assert.equal(e.estado().creado,false);
});

test('errores de cierre y eliminación exigen revisión sin revelar mensajes originales',async()=>{
    for(const config of [{fallarCierre:true},{fallarInstaller:true,fallarRm:true}]) {
        const e=escenario(config);await assert.rejects(ejecutarValidacion(e.opciones),err=>{
            assert.equal(err.revisionManual,true);assert.ok(!err.stack.includes(e.secreto));assert.ok(!JSON.stringify(err).includes(e.secreto));
            assert.ok(!JSON.stringify(err).includes(hashSintetico));return true;
        });
    }
});

test('proceso interactivo hereda terminal sin capturar entrada/salida ni pasar contraseña por argumentos',async()=>{
    const controller=new AbortController(), modos=[];let opcionesHijo, argumentos;
    const r=await lanzar('primer-dueno.js',{DEMO_DB_PASSWORD:'conexion-simulada'},controller.signal,true,{
        entrada:{isTTY:true,isRaw:false,setRawMode:m=>modos.push(m)},
        iniciar:(_,args,opts)=>{
            argumentos=args;opcionesHijo=opts;
            const child=new EventEmitter();queueMicrotask(()=>child.emit('close',0));return child;
        }
    });
    assert.equal(r,0);assert.equal(opcionesHijo.stdio,'inherit');
    assert.ok(!argumentos.some(a=>a.includes('conexion-simulada')));
    assert.deepEqual(modos,[false]);
});

test('cancelar hijo espera cierre antes de rechazar y restaura modo de terminal',async()=>{
    const controller=new AbortController(), child=new EventEmitter(), modos=[];
    let terminado=false, kills=0;
    child.kill=()=>{kills++;};
    const tarea=lanzar('primer-dueno.js',{},controller.signal,true,{
        entrada:{isTTY:true,isRaw:false,setRawMode:m=>modos.push(m)},iniciar:()=>child
    });
    const rechazo=assert.rejects(tarea,/cancelado/).then(()=>{terminado=true;});
    controller.abort();await new Promise(r=>setImmediate(r));assert.equal(kills,1);assert.equal(terminado,false);
    child.emit('close',null);await rechazo;assert.equal(terminado,true);assert.deepEqual(modos,[false]);
    const cancelado=new AbortController();cancelado.abort();
    await assert.rejects(lanzar('primer-dueno.js',{},cancelado.signal,true,{iniciar:()=>assert.fail('No iniciar')}));
});
