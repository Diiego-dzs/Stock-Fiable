const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { verificarEsquema } = require('./verificar-esquema-demo');
const { crearDueno } = require('../../scripts/demo/primer-dueno');
const { CATEGORIAS } = require('../../scripts/demo/instalar');
const IMAGEN = 'docker.io/library/mariadb:11.4.9@sha256:54ac814d243128263e18cf818f7abb611bf43a7a95ce8aa102d18f527b1516d1';
const ETIQUETA = 'stock-fiable.primer-dueno';
const BASE = 'stock_fiable_demo';
const fallo = () => { throw new Error('Comprobación de seguridad fallida'); };
function exigir(condicion) { if (!condicion) fallo(); }

function validarInicio(env, args, tty) {
    exigir(args.length === 1 && args[0] === '--ejecutar' && tty);
    for (const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) exigir(!env[k]);
}

function entornoHijo(env, puerto, password) {
    const limpio = Object.fromEntries(Object.entries(env).filter(([k]) => !/^(DB_|DEMO_DB_|MARIADB_|DOTENV_)/i.test(k) && k !== 'NODE_OPTIONS'));
    return { ...limpio, DEMO_DB_HOST:'127.0.0.1', DEMO_DB_PORT:String(puerto), DEMO_DB_NAME:BASE,
        DEMO_DB_USER:'sf_demo', DEMO_DB_PASSWORD:password };
}

// Dependencies are injectable for tests. This function never receives the owner's password.
async function ejecutarValidacion({ docker, instalar, dueno, conectar, identidad, password, rootPassword,
    signal, verificar = verificarEsquema, esperar = ms => new Promise(r => setTimeout(r,ms)), informar = () => {} }) {
    exigir(/^sf_owner_[a-f0-9]{24}$/.test(identidad));
    let id, intento = false, etapa = 'contexto', error, limpiezaFallida = false;
    const conexiones = new Set();
    const comprobar = () => { if (signal?.aborted) throw new Error('Cancelación solicitada'); };
    async function propio(ref, limpieza = false) {
        if (!limpieza) comprobar();
        const lista = JSON.parse(await docker(['container','inspect',ref]));
        exigir(lista.length === 1);
        const x = lista[0];
        exigir(/^[a-f0-9]{64}$/.test(x.Id || '') && (!id || x.Id === id));
        exigir(x.Name === '/' + identidad && x.Config.Hostname === identidad && x.Config.Image === IMAGEN);
        exigir(x.Config.Labels?.[ETIQUETA] === identidad);
        exigir(!x.HostConfig.Binds?.length && x.HostConfig.Tmpfs?.['/var/lib/mysql']);
        exigir(x.Mounts.every(m => m.Type === 'tmpfs'));
        const binds = x.HostConfig.PortBindings;
        exigir(Object.keys(binds || {}).length === 1 && binds['3306/tcp']?.length === 1 && binds['3306/tcp'][0].HostIp === '127.0.0.1');
        if (!limpieza) comprobar();
        return x;
    }
    async function destino() {
        const x = await propio(id);
        exigir(x.State.Running && x.State.Health?.Status === 'healthy');
        const p = x.NetworkSettings.Ports?.['3306/tcp'];
        exigir(p?.length === 1 && p[0].HostIp === '127.0.0.1');
        const port = Number(p[0].HostPort);
        exigir(Number.isInteger(port) && port >= 1 && port <= 65535);
        return { host:'127.0.0.1', port, database:BASE, user:'sf_demo', password, connectTimeout:5000, socketTimeout:10000 };
    }
    async function conConexion(tarea) {
        const opciones = await destino(); comprobar();
        const c = await conectar(opciones); conexiones.add(c);
        let resultado, principal;
        try {
            comprobar();
            const [r] = await c.query('SELECT DATABASE() AS db, @@hostname AS hostname');
            exigir(r.db === BASE && r.hostname === identidad); comprobar();
            resultado = await tarea(c); comprobar();
        } catch (e) { principal = e; }
        try { await c.end(); conexiones.delete(c); }
        catch (e) { limpiezaFallida = true; if (!principal) principal = e; }
        if (principal) throw principal;
        return resultado;
    }
    async function usuarios(c) {
        const rows = await c.query('SELECT id, rol, activo, contrasena FROM usuarios ORDER BY id');
        exigir(rows.length === 1 && rows[0].rol === 'Dueño' && Number(rows[0].activo) === 1);
        exigir(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(rows[0].contrasena));
        return rows[0]; // Never printed, sent to a child, or attached to an error.
    }
    try {
        comprobar();
        const lista = JSON.parse(await docker(['context','inspect','default'])); comprobar();
        exigir(lista.length === 1 && ['unix:///var/run/docker.sock','npipe:////./pipe/docker_engine'].includes(lista[0].Endpoints?.docker?.Host));
        exigir((await docker(['info','--format','{{.OSType}}'])) === 'linux'); comprobar();
        etapa = 'imagen'; await docker(['pull',IMAGEN]); comprobar();
        etapa = 'creación'; intento = true;
        id = await docker(['create','--name',identidad,'--hostname',identidad,'--label',ETIQUETA+'='+identidad,
            '--tmpfs','/var/lib/mysql:rw,nosuid,size=512m','--publish','127.0.0.1::3306',
            '--health-cmd','healthcheck.sh --connect --innodb_initialized','--health-interval','2s','--health-timeout','5s','--health-retries','30','--health-start-period','10s',
            '--env','MARIADB_ROOT_PASSWORD','--env','MARIADB_DATABASE','--env','MARIADB_USER','--env','MARIADB_PASSWORD',IMAGEN],
        { MARIADB_ROOT_PASSWORD:rootPassword, MARIADB_DATABASE:BASE, MARIADB_USER:'sf_demo', MARIADB_PASSWORD:password });
        comprobar();
        if (!/^[a-f0-9]{64}$/.test(id || '')) { id = undefined; fallo(); }
        await propio(id); etapa = 'inicio'; comprobar(); await docker(['start',id]); comprobar();
        etapa = 'salud'; const limite = Date.now()+120000;
        while (true) {
            const x = await propio(id);
            if (x.State.Health?.Status === 'healthy') break;
            exigir(x.State.Running && x.State.Health?.Status !== 'unhealthy' && Date.now()<limite);
            await esperar(1000); comprobar();
        }
        const { port } = await destino();
        informar({ etapa:'contenedor verificado', identidad, id, puerto:port });
        etapa = 'base vacía'; await conConexion(async c => { exigir((await c.query('SHOW FULL TABLES')).length === 0); });
        etapa = 'instalación'; await destino(); comprobar(); exigir(await instalar(port,password,signal) === 0); comprobar();
        etapa = 'esquema y fixtures'; await conConexion(async c => {
            exigir((await verificar(c)).valido); comprobar();
            const cats = await c.query('SELECT nombre FROM categorias ORDER BY nombre'); comprobar();
            exigir(JSON.stringify(cats.map(r=>r.nombre).sort()) === JSON.stringify([...CATEGORIAS].sort()));
            const [r] = await c.query('SELECT COUNT(*) AS total FROM usuarios'); exigir(BigInt(r.total) === 0n);
        });
        etapa = 'primer Dueño interactivo'; await destino(); comprobar();
        informar({ etapa:'Introducir solo identidad ficticia; contraseña únicamente en el prompt oculto original.' });
        exigir(await dueno(port,password,signal) === 0); comprobar();
        etapa = 'Dueño y bcrypt'; await conConexion(async c => { await usuarios(c); });
        informar({ etapa:'Un único Dueño activo, bcrypt costo 12 verificado.' });
        etapa = 'rechazo segunda inicialización'; await conConexion(async c => {
            const antes = await usuarios(c);
            let rechazo = false;
            try {
                // Exercise the original exported guard. This marker is NOT an owner credential:
                // rejection must happen before hashing or INSERT; the user's password is never reused.
                await crearDueno(c, { nombre:'Demostración', email:'demo@example.invalid', contrasena:'marcador-de-rechazo' },
                    async () => { throw new Error('No debe calcularse un hash en una segunda inicialización'); });
            } catch (e) { rechazo = e.message === 'La tabla usuarios no está vacía; no se creará otro Dueño inicial'; }
            exigir(rechazo); comprobar();
            const despues = await usuarios(c);
            exigir(antes.id === despues.id && antes.rol === despues.rol && antes.activo === despues.activo && antes.contrasena === despues.contrasena);
        });
        informar({ etapa:'Segunda inicialización rechazada antes de hash/INSERT; cuenta sin cambios.' });
    } catch (_) { error = etapa; }
    finally {
        for (const c of conexiones) try { await c.end(); } catch { limpiezaFallida = true; }
        if (intento) try {
            const x = await propio(id || identidad,true); id = x.Id;
            if (x.State.Running) { await propio(id,true); await docker(['stop','--time','5',id]); }
            await propio(id,true); await docker(['rm',id]);
            exigir((await docker(['ps','-a','--filter','label='+ETIQUETA+'='+identidad,'--format','{{.ID}}'])) === '');
        } catch { limpiezaFallida = true; }
    }
    if (error || limpiezaFallida) {
        const e = new Error('Validación detenida; detalle original omitido');
        e.etapa = error || 'limpieza'; e.identidad = identidad; e.revisionManual = limpiezaFallida; throw e;
    }
    return { identidad, id, limpio:true };
}

// No pipe is attached to the interactive child: the original terminal owns input/output.
function lanzar(script, env, signal, interactivo, { iniciar = spawn, entrada = process.stdin } = {}) {
    return new Promise((resolve,reject) => {
        if (signal.aborted) { reject(new Error('Cancelado')); return; }
        const modoRaw = !!entrada.isRaw;
        const child = iniciar(process.execPath,[path.resolve(__dirname,'../../scripts/demo',script),'--autorizar-demo','--confirmar-base',BASE],
            { env, stdio:interactivo ? 'inherit' : 'ignore', windowsHide:true });
        let falloChild = false;
        const cancelar = () => { falloChild = true; child.kill(); };
        const timer = setTimeout(cancelar,interactivo ? 600000 : 60000);
        signal.addEventListener('abort',cancelar,{once:true});
        if (signal.aborted) cancelar();
        child.on('error',()=>{ falloChild = true; });
        child.on('close',code=>{
            clearTimeout(timer);signal.removeEventListener('abort',cancelar);
            if (interactivo && entrada.isTTY) try { entrada.setRawMode(modoRaw); } catch { falloChild = true; }
            if (falloChild || signal.aborted) reject(new Error('Proceso de prueba cancelado o fallido'));
            else resolve(code);
        });
    });
}

async function main() {
    validarInicio(process.env,process.argv.slice(2),process.stdin.isTTY && process.stdout.isTTY);
    const controller = new AbortController();
    const cancelar = () => controller.abort();
    process.on('SIGINT',cancelar);process.on('SIGTERM',cancelar);
    const exec = promisify(execFile);
    const docker = async (args, variables={}) => (await exec('docker',['--context','default',...args],
        { env:{...process.env,...variables}, timeout:120000, maxBuffer:1048576, windowsHide:true })).stdout.trim();
    try {
        const resultado = await ejecutarValidacion({ docker, identidad:'sf_owner_'+randomBytes(12).toString('hex'),
            password:randomBytes(32).toString('hex'), rootPassword:randomBytes(32).toString('hex'), signal:controller.signal,
            conectar:opts=>require('mariadb').createConnection(opts),
            instalar:(port,pass,signal)=>lanzar('instalar.js',entornoHijo(process.env,port,pass),signal,false),
            dueno:(port,pass,signal)=>lanzar('primer-dueno.js',entornoHijo(process.env,port,pass),signal,true),
            informar:estado=>console.log(JSON.stringify(estado)) });
        console.log(JSON.stringify(resultado));
    } finally { process.off('SIGINT',cancelar);process.off('SIGTERM',cancelar); }
}
if (require.main === module) main().catch(e=>{
    console.error(JSON.stringify({ etapa:e.etapa || 'precondiciones: requiere --ejecutar, TTY y Docker local sin redirección',
        ejecucion:e.identidad, revisionManual:!!e.revisionManual }));
    process.exitCode = 1;
});
module.exports = { ejecutarValidacion, validarInicio, entornoHijo, lanzar, IMAGEN, ETIQUETA };
