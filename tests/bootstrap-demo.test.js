const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { BASE, TABLAS, configuracion, conDestino, validarDueno } = require('../scripts/demo/comun');
const { instalar, CATEGORIAS } = require('../scripts/demo/instalar');
const { crearDueno, preguntar } = require('../scripts/demo/primer-dueno');
const args = ['--autorizar-demo', '--confirmar-base', BASE];
const env = { DEMO_DB_HOST: '127.0.0.1', DEMO_DB_PORT: '3307', DEMO_DB_NAME: BASE, DEMO_DB_USER: 'sintetico', DEMO_DB_PASSWORD: 'solo-mock' };
const datos = { nombre: ' Demo ', email: 'DEMO@example.invalid ', contrasena: 'solo-mock-123' };
function mock(responder = () => []) {
    const llamadas = [];
    const c = { query: async (sql, params) => { llamadas.push([sql, params]); return responder(sql, params); } };
    for (const nombre of ['beginTransaction', 'commit', 'rollback', 'end']) c[nombre] = async () => { llamadas.push([nombre]); };
    return { c, llamadas };
}

test('demo exige autorización, configuración propia y base local fija sin fallback DB_*', () => {
    const config = configuracion({ ...env, DB_NAME: 'no-utilizar', DB_PASSWORD: 'no-utilizar' }, args);
    assert.equal(config.database, BASE); assert.equal(config.password, env.DEMO_DB_PASSWORD);
    for (const [variables, argv] of [ [{}, args], [env, []], [env, [...args, '--password', 'x']],
        [{ ...env, DEMO_DB_NAME: 'otra' }, args], [{ ...env, DEMO_DB_HOST: 'externo' }, args],
        [{ ...env, DEMO_DB_PORT: '65536' }, args], [{ ...env, DEMO_DB_PASSWORD: '' }, args] ]) {
        assert.throws(() => configuracion(variables, argv));
    }
});

test('demo comprueba destino antes de bloquear o escribir; siempre cierra conexión', async () => {
    const m = mock(() => [{ db: 'otro' }]);
    await assert.rejects(conDestino({}, () => assert.fail('no ejecutar'), async () => m.c), /base conectada/);
    assert.deepEqual(m.llamadas.map(l => l[0]), ['SELECT DATABASE() AS db', 'end']);
});

test('demo serializa bootstrap y libera bloqueo incluso ante fallo conservando el error', async () => {
    const fallo = new Error('principal');
    const m = mock(sql => sql.includes('DATABASE') ? [{ db: BASE }] : [{ adquirido: 1 }]);
    await assert.rejects(conDestino({}, async () => { throw fallo; }, async () => m.c), e => e === fallo);
    assert.ok(m.llamadas[1][0].includes('GET_LOCK'));
    assert.ok(m.llamadas.at(-2)[0].includes('RELEASE_LOCK'));
    assert.equal(m.llamadas.at(-1)[0], 'end');
    const ocupado = mock(sql => sql.includes('DATABASE') ? [{ db: BASE }] : [{ adquirido: 0 }]);
    await assert.rejects(conDestino({}, () => assert.fail('no ejecutar'), async () => ocupado.c), /curso/);
});

test('instalador demo rechaza cualquier tabla existente sin escrituras', async () => {
    const m = mock(() => [{ tabla: 'existente', tipo: 'BASE TABLE' }]);
    await assert.rejects(instalar(m.c), /vacía/);
    assert.equal(m.llamadas.length, 1);
});

test('instalador crea seis tablas compatibles y categorías sin IDs fijos ni fixtures', async () => {
    const m = mock(); assert.deepEqual(await instalar(m.c), { tablas: 6, categorias: 3 });
    const ddl = m.llamadas.filter(l => l[0].startsWith('CREATE TABLE'));
    assert.equal(ddl.length, 6);
    for (const [sql] of ddl) assert.match(sql, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/);
    assert.ok(ddl.some(l => l[0].includes('DECIMAL(10,2)')));
    const insert = m.llamadas.filter(l => l[0].startsWith('INSERT'));
    assert.equal(insert.length, CATEGORIAS.length);
    assert.ok(insert.every(l => l[0] === 'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)'));
    assert.equal(m.llamadas.at(-1)[0], 'commit');
});

test('instalador reporta DDL parcial y revierte categorías sin borrar tablas', async () => {
    for (const punto of ['CREATE TABLE productos', 'INSERT INTO categorias']) {
        const m = mock(sql => { if (sql.startsWith(punto)) throw new Error('fallo simulado'); return []; });
        await assert.rejects(instalar(m.c), /posiblemente incompleta/);
        assert.ok(!m.llamadas.some(l => /^(DROP|DELETE|TRUNCATE|UPDATE)/.test(l[0])));
        if (punto.startsWith('INSERT')) assert.equal(m.llamadas.at(-1)[0], 'rollback');
    }
});

test('primer Dueño respeta validaciones existentes y límites UTF-8 sin coerción', () => {
    assert.deepEqual(validarDueno(datos.nombre, datos.email, datos.contrasena), { nombre: 'Demo', email: 'demo@example.invalid' });
    assert.doesNotThrow(() => validarDueno('Demo', datos.email, 'ñ'.repeat(36)));
    for (const d of [ { ...datos, nombre: '' }, { ...datos, nombre: 'x'.repeat(101) },
        { ...datos, email: 'sin-formato' }, { ...datos, contrasena: true },
        { ...datos, contrasena: 'corta' }, { ...datos, contrasena: 'ñ'.repeat(37) } ]) {
        assert.throws(() => validarDueno(d.nombre, d.email, d.contrasena));
    }
});

function duenoMock({ existente = false, carrera = false, fallo = false } = {}) {
    return mock(sql => {
        if (sql === 'SHOW FULL TABLES') return TABLAS.map(t => ({ tabla: t }));
        if (sql.includes('COUNT')) return [{ total: existente ? 1 : 0 }];
        if (sql.includes('FOR UPDATE')) return carrera ? [{ id: 1 }] : [];
        if (fallo && sql.startsWith('INSERT')) throw new Error('fallo simulado');
        return [];
    });
}

test('primer Dueño usa bcrypt costo 12 y consulta parametrizada con rol y estado fijos', async () => {
    const m = duenoMock();
    await crearDueno(m.c, datos, async (texto, costo) => { assert.equal(texto, datos.contrasena); assert.equal(costo, 12); return 'hash-simulado'; });
    const insert = m.llamadas.find(l => l[0].startsWith('INSERT'));
    assert.deepEqual(insert[1], ['Demo', 'demo@example.invalid', 'hash-simulado', 'Dueño', 1]);
    assert.equal(m.llamadas.at(-1)[0], 'commit');
});

test('primer Dueño rechaza esquema incompleto, usuarios existentes y segundo intento concurrente', async () => {
    await assert.rejects(crearDueno(mock().c, datos, async () => 'hash'), /esquema/);
    for (const opciones of [{ existente: true }, { carrera: true }]) {
        const m = duenoMock(opciones);
        await assert.rejects(crearDueno(m.c, datos, async () => 'hash'), /no está vacía/);
        assert.ok(!m.llamadas.some(l => l[0].startsWith('INSERT')));
        if (opciones.carrera) assert.equal(m.llamadas.at(-1)[0], 'rollback');
    }
});

test('primer Dueño hace rollback ante fallo de inserción', async () => {
    const m = duenoMock({ fallo: true });
    await assert.rejects(crearDueno(m.c, datos, async () => 'hash'), /fallo simulado/);
    assert.equal(m.llamadas.at(-1)[0], 'rollback');
});

test('entrada secreta no escribe la contraseña y exige terminal interactiva', async () => {
    let visible = '';
    const output = { isTTY: true, write: texto => { visible += texto; } };
    const interfaz = ({ output: salida }) => {
        const rl = new EventEmitter();
        rl.close = () => rl.emit('close');
        rl.question = (_, responder) => { salida.write('secreto-simulado'); responder('secreto-simulado'); };
        return rl;
    };
    assert.equal(await preguntar('Contraseña: ', true, { input: { isTTY: true }, output, interfaz }), 'secreto-simulado');
    assert.equal(visible, 'Contraseña: \n');
    await assert.rejects(preguntar('', true, { input: { isTTY: false }, output, interfaz }), /interactiva/);
});
