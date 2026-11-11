const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomBytes } = require('node:crypto');
const { crearEntorno, conservarError } = require('./helpers/mariadb');
const ejecutar = promisify(execFile);
const IMAGEN = 'docker.io/library/mariadb:11.4.9@sha256:54ac814d243128263e18cf818f7abb611bf43a7a95ce8aa102d18f527b1516d1';
const ETIQUETA = 'stock-fiable.integration';

// Injectable lifecycle for mock-only tests. The CLI below is the only real Docker adapter.
async function ejecutarCiclo({ docker, identidad, password, rootPassword, signal, crear = crearEntorno, esperar = ms => new Promise(r => setTimeout(r, ms)) }) {
    if (!/^sf_it_[a-f0-9]{24}$/.test(identidad)) throw new Error('Identidad temporal inválida');
    let id, entorno, intentoCrear = false, etapa = 'contexto', error;
    const comprobar = () => { if (signal?.aborted) throw new Error('Cancelación solicitada'); };
    async function inspeccionar(ref, limpieza = false) {
        if (!limpieza) comprobar();
        const candidatos = JSON.parse(await docker(['inspect', ref]));
        if (candidatos.length !== 1) throw new Error('Recurso ambiguo');
        const info = candidatos[0];
        if (!/^[a-f0-9]{64}$/.test(info.Id || '') || (id && info.Id !== id) || info.Name !== '/' + identidad || info.Config.Labels?.[ETIQUETA] !== identidad || info.Config.Hostname !== identidad || info.Config.Image !== IMAGEN) throw new Error('Propiedad del recurso no verificada');
        if (!limpieza) comprobar();
        return info;
    }
    async function verificar() {
        comprobar();
        const info = await inspeccionar(id);
        const puertos = info.NetworkSettings.Ports?.['3306/tcp'];
        if (!info.State.Running || info.State.Health?.Status !== 'healthy' || puertos?.length !== 1 || puertos[0].HostIp !== '127.0.0.1' || info.HostConfig.Binds?.length || !info.HostConfig.Tmpfs?.['/var/lib/mysql'] || info.Mounts.some(m => m.Type !== 'tmpfs')) throw new Error('Aislamiento o disponibilidad no válidos');
        return { host: '127.0.0.1', port: Number(puertos[0].HostPort), hostname: identidad };
    }
    try {
        comprobar();
        const [contexto] = JSON.parse(await docker(['context', 'inspect', 'default']));
        comprobar();
        if (!['unix:///var/run/docker.sock', 'npipe:////./pipe/docker_engine'].includes(contexto.Endpoints?.docker?.Host)) throw new Error('Contexto no autorizado');
        etapa = 'descarga'; comprobar(); await docker(['pull', IMAGEN]); comprobar();
        etapa = 'creación'; intentoCrear = true; comprobar();
        id = await docker(['create', '--name', identidad, '--hostname', identidad, '--label', ETIQUETA + '=' + identidad,
            '--tmpfs', '/var/lib/mysql:rw,nosuid,size=512m', '--publish', '127.0.0.1::3306',
            '--health-cmd', 'healthcheck.sh --connect --innodb_initialized', '--health-interval', '2s', '--health-timeout', '5s', '--health-retries', '30', '--health-start-period', '10s',
            '--env', 'MARIADB_ROOT_PASSWORD', '--env', 'MARIADB_DATABASE', '--env', 'MARIADB_USER', '--env', 'MARIADB_PASSWORD', IMAGEN],
            { MARIADB_ROOT_PASSWORD: rootPassword, MARIADB_DATABASE: identidad, MARIADB_USER: 'sf_test', MARIADB_PASSWORD: password });
        comprobar();
        if (!/^[a-f0-9]{64}$/.test(id || '')) { id = undefined; throw new Error('ID de creación inválido'); }
        etapa = 'inspección'; await inspeccionar(id); comprobar();
        etapa = 'inicio'; comprobar(); await docker(['start', id]); comprobar();
        etapa = 'salud'; const limite = Date.now() + 120000;
        while (true) {
            comprobar(); const info = await inspeccionar(id);
            if (info.State.Health?.Status === 'healthy') break;
            if (!info.State.Running || info.State.Health?.Status === 'unhealthy' || Date.now() >= limite) throw new Error('MariaDB temporal no quedó disponible');
            await esperar(1000);
        }
        etapa = 'pool'; comprobar();
        entorno = await crear({ verificar, database: identidad, marcador: identidad, user: 'sf_test', password, signal });
        etapa = 'esquema'; comprobar(); await entorno.preparar(); comprobar();
        etapa = 'inyección'; entorno.inyectarServicios(); comprobar();
    } catch (e) { error = e; error.etapa = etapa; }
    // Cancellation forbids new workload, but must not disable cleanup inspections.
    try { if (entorno) await entorno.cerrar(); } catch (e) { e.etapa = 'cierre del pool'; error = conservarError(error, e); }
    if (intentoCrear) {
        try {
            const propio = await inspeccionar(id || identidad, true);
            id = propio.Id;
            if (propio.State.Running) { await inspeccionar(id, true); await docker(['stop', '--time', '5', id]); }
            await inspeccionar(id, true); await docker(['rm', id]);
        } catch (e) {
            e.etapa = 'limpieza del contenedor'; error = conservarError(error, e);
            error.revisionManual = true;
        }
    }
    if (error) { error.identidad = identidad; throw error; }
    return { identidad };
}

async function main() {
    if (process.argv.length !== 3 || process.argv[2] !== '--ejecutar') throw new Error('Requiere autorización explícita --ejecutar');
    if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT || process.env.DOCKER_TLS_VERIFY || process.env.DOCKER_CERT_PATH) throw new Error('Configuración Docker externa no permitida');
    const controller = new AbortController();
    const cancelar = () => controller.abort();
    process.on('SIGINT', cancelar); process.on('SIGTERM', cancelar);
    const docker = async (args, variables = {}) => {
        try {
            return (await ejecutar('docker', ['--context', 'default', ...args], { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true, env: { ...process.env, ...variables } })).stdout.trim();
        } catch { throw new Error('Operación Docker fallida; salida omitida'); }
    };
    try {
        await ejecutarCiclo({ docker, identidad: 'sf_it_' + randomBytes(12).toString('hex'), password: randomBytes(32).toString('hex'), rootPassword: randomBytes(32).toString('hex'), signal: controller.signal });
        console.log('Infraestructura temporal preparada y retirada; no se ejecutó una suite real de concurrencia.');
    } finally { process.off('SIGINT', cancelar); process.off('SIGTERM', cancelar); }
}
if (require.main === module) main().catch(error => {
    console.error('Fallo en ' + (error.etapa || 'preparación') + (error.identidad ? ' [' + error.identidad + ']' : '') + '.');
    for (const e of error.erroresLimpieza || []) console.error('Fallo adicional en ' + (e.etapa || 'liberación de recursos') + '.');
    if (error.revisionManual) console.error('Se requiere revisión manual del recurso identificado; no se eliminó sin verificar su propiedad.');
    process.exitCode = 1;
});
module.exports = { IMAGEN, ETIQUETA, ejecutarCiclo };
