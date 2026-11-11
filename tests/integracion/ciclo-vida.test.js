const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ejecutarCiclo, IMAGEN, ETIQUETA } = require('./run');
const { crearEntorno } = require('./helpers/mariadb');
const { prepararSchema } = require('./fixtures/schema');
const identidad = 'sf_it_' + 'b'.repeat(24), id = 'a'.repeat(64);
function diferida() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function escenario({ controller, falloCreate, ajeno, falloRm, cancelarInspeccion, falloPreparar, falloCerrar } = {}) {
    const llamadas = [];
    let creado = false, running = false, inspecciones = 0;
    const principal = new Error('fallo principal simulado');
    async function docker(args) {
        llamadas.push(args);
        if (args[0] === 'context') return JSON.stringify([{ Endpoints: { docker: { Host: 'unix:///var/run/docker.sock' } } }]);
        if (args[0] === 'pull') return '';
        if (args[0] === 'create') { creado = true; if (falloCreate) throw principal; if (controller && !cancelarInspeccion) controller.abort(); return id; }
        if (args[0] === 'inspect') {
            assert.ok(creado); assert.ok([id, identidad].includes(args[1])); inspecciones++;
            if (cancelarInspeccion && inspecciones === 1) controller.abort();
            return JSON.stringify([{ Id: id, Name: '/' + identidad, Config: { Hostname: identidad, Image: IMAGEN, Labels: { [ETIQUETA]: ajeno ? 'otro' : identidad } }, State: { Running: running, Health: { Status: 'healthy' } }, HostConfig: { Tmpfs: { '/var/lib/mysql': 'rw' }, Binds: null }, Mounts: [{ Type: 'tmpfs' }], NetworkSettings: { Ports: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: '32001' }] } } }]);
        }
        if (args[0] === 'start') { running = true; return ''; }
        if (args[0] === 'stop') { running = false; return ''; }
        if (args[0] === 'rm') { if (falloRm) throw new Error('limpieza simulada'); return ''; }
        assert.fail('Operación no prevista');
    }
    const opciones = { docker, identidad, password: 'sintetica', rootPassword: 'sintetica-root', signal: controller?.signal, pruebas: async () => {},
        crear: async ({ verificar }) => {
            await verificar();
            return { preparar: async () => { if (falloPreparar) throw principal; }, inyectarServicios() {}, cerrar: async () => { if (falloCerrar) throw new Error('cierre simulado'); } };
        } };
    return { opciones, llamadas, principal };
}

test('cancelar después de create impide start y permite limpiar solamente el ID propio', async () => {
    const e = escenario({ controller: new AbortController() });
    await assert.rejects(ejecutarCiclo(e.opciones), /Cancelación/);
    assert.ok(!e.llamadas.some(a => a[0] === 'start'));
    assert.deepEqual(e.llamadas.find(a => a[0] === 'rm'), ['rm', id]);
});
test('cancelar durante inspección impide start', async () => {
    const e = escenario({ controller: new AbortController(), cancelarInspeccion: true });
    await assert.rejects(ejecutarCiclo(e.opciones), /Cancelación/);
    assert.ok(!e.llamadas.some(a => a[0] === 'start'));
});
test('create fallido después de crear recupera por nombre exacto y conserva el error original', async () => {
    const e = escenario({ falloCreate: true });
    await assert.rejects(ejecutarCiclo(e.opciones), error => error === e.principal);
    assert.ok(e.llamadas.some(a => a[0] === 'inspect' && a[1] === identidad));
    assert.deepEqual(e.llamadas.find(a => a[0] === 'rm'), ['rm', id]);
});
test('rechaza limpieza ajena y solicita revisión manual', async () => {
    const e = escenario({ falloCreate: true, ajeno: true });
    await assert.rejects(ejecutarCiclo(e.opciones), error => error === e.principal && error.revisionManual && error.erroresLimpieza.length === 1);
    assert.ok(!e.llamadas.some(a => ['rm', 'stop', 'start'].includes(a[0])));
});
test('ID incompleto, nombre ajeno, imagen distinta y respuestas ambiguas impiden eliminación', async () => {
    for (const modificar of [
        info => { info.Id = 'a'.repeat(12); },
        info => { info.Name = '/otro'; },
        info => { info.Config.Image = 'mariadb:latest'; },
        info => { info.Config.Hostname = 'otro'; },
        (info, lista) => { lista.push(structuredClone(info)); }
    ]) {
        const e = escenario({ falloCreate: true });
        const original = e.opciones.docker;
        e.opciones.docker = async args => {
            const resultado = await original(args);
            if (args[0] !== 'inspect') return resultado;
            const lista = JSON.parse(resultado); modificar(lista[0], lista); return JSON.stringify(lista);
        };
        await assert.rejects(ejecutarCiclo(e.opciones), error => error === e.principal && error.revisionManual);
        assert.ok(!e.llamadas.some(a => ['rm', 'stop', 'start'].includes(a[0])));
    }
});
test('fallos de cierre y eliminación no ocultan el error de preparación', async () => {
    const e = escenario({ falloPreparar: true, falloCerrar: true, falloRm: true });
    await assert.rejects(ejecutarCiclo(e.opciones), error => error === e.principal && error.erroresLimpieza.length === 2 && error.revisionManual);
});
test('ciclo normal verifica, prepara y retira el recurso', async () => {
    const e = escenario(); await ejecutarCiclo(e.opciones);
    assert.ok(e.llamadas.some(a => a[0] === 'start'));
    assert.deepEqual(e.llamadas.at(-1), ['rm', id]);
});

test('fallo de escenario Fase 2A conserva diagnóstico y limpia el contenedor propio', async () => {
    const e = escenario();
    const fallo = Object.assign(new Error('fallo de prueba'), { etapa: 'Fase 2A: simulada' });
    e.opciones.pruebas = async () => { throw fallo; };
    await assert.rejects(ejecutarCiclo(e.opciones), error => error === fallo && error.etapa === 'Fase 2A: simulada');
    assert.deepEqual(e.llamadas.at(-1), ['rm', id]);
});

async function helper({ getConnection, end = async () => {}, signal } = {}) {
    return crearEntorno({ verificar: async () => ({ host: '127.0.0.1', port: 32001, hostname: identidad }), database: identidad, marcador: identidad, user: 'sintetico', password: 'sintetica', signal }, () => ({ getConnection, end }));
}
function conexion(release = async () => {}) { return { query: async () => [{ db: identidad, hostname: identidad }], release }; }

test('cierre espera adquisición pendiente, no entrega conexión y comparte promesa', async () => {
    const inicio = diferida(), adquirir = diferida(), liberar = diferida(); let terminados = 0;
    const entorno = await helper({ getConnection: () => { inicio.resolve(); return adquirir.promise; }, end: async () => { terminados++; } });
    const pendiente = entorno.pool.getConnection(); const rechazo = assert.rejects(pendiente, /cerrado/);
    await inicio.promise;
    const a = entorno.cerrar(), b = entorno.cerrar(); assert.equal(a, b);
    adquirir.resolve(conexion(() => liberar.promise));
    await new Promise(r => setImmediate(r)); assert.equal(terminados, 0);
    liberar.resolve(); await rechazo; await a; assert.equal(terminados, 1);
    await assert.rejects(entorno.pool.getConnection(), /cerrado/);
});
test('conConexion espera release asíncrono', async () => {
    const iniciado = diferida(), liberar = diferida(); let finalizada = false;
    const entorno = await helper({ getConnection: async () => conexion(() => { iniciado.resolve(); return liberar.promise; }) });
    const tarea = entorno.conConexion(async () => 42).then(r => { finalizada = true; return r; });
    await iniciado.promise; assert.equal(finalizada, false); liberar.resolve(); assert.equal(await tarea, 42); await entorno.cerrar();
});
test('release fallido preserva el error principal y el cierre reporta fallos', async () => {
    const principal = new Error('principal'), fallo = new Error('release'); let termino = false;
    const entorno = await helper({ getConnection: async () => conexion(async () => { throw fallo; }), end: async () => { termino = true; } });
    await assert.rejects(entorno.conConexion(async () => { throw principal; }), e => e === principal && e.erroresLimpieza[0] === fallo);
    await assert.rejects(entorno.cerrar(), e => e === fallo); assert.ok(termino);
});
test('cancelación antes del pool evita incluso su creación', async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(crearEntorno({ verificar: async () => assert.fail('No verificar'), database: identidad, marcador: identidad, signal: controller.signal }, () => assert.fail('No crear pool')), /cancelada/);
});
test('cancelación entre consultas del esquema no ejecuta la siguiente operación', async () => {
    let consultas = 0;
    await assert.rejects(prepararSchema({ query: async () => { consultas++; return []; } }, identidad, () => { if (consultas >= 2) throw new Error('cancelado'); }), /cancelado/);
    assert.equal(consultas, 2);
});
