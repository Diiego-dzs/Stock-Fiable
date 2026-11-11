const { test } = require('node:test');
const assert = require('node:assert/strict');
const { centavos } = require('./precision');
const { crearEntorno } = require('./helpers/mariadb');

test('oráculo decimal independiente exige texto con dos decimales y conserva el máximo', () => {
    assert.equal(centavos('0.10') + centavos('0.20'), 30n);
    assert.equal(centavos('99999999.99'), 9999999999n);
    for (const valor of [0.1, '0.1', '0.001', '1e2', 'NaN', '-0.01']) assert.throws(() => centavos(valor));
});

test('interceptor deja pasar consultas previas, propaga fallo y se retira tras error', async () => {
    const database = 'sf_it_' + 'c'.repeat(24);
    const ejecutadas = [];
    let liberadas = 0, cerradas = 0;
    const entorno = await crearEntorno({
        database, marcador: database, user: 'sintetico', password: 'sintetica',
        verificar: async () => ({ host: '127.0.0.1', port: 32001, hostname: database })
    }, () => ({
        getConnection: async () => ({
            query: async sql => {
                ejecutadas.push(sql);
                return [{ db: database, hostname: database }];
            },
            release: async () => { await new Promise(r => setImmediate(r)); liberadas++; }
        }),
        end: async () => { cerradas++; }
    }));
    const fallo = new Error('Fallo controlado');
    try {
        await assert.rejects(entorno.conInterceptor(sql => {
            if (sql === 'SEGUNDA') throw fallo;
        }, () => entorno.conConexion(async c => {
            await c.query('PRIMERA'); await c.query('SEGUNDA');
        })), e => e === fallo);
        await entorno.esperarLiberaciones();
        assert.ok(ejecutadas.includes('PRIMERA'));
        assert.ok(!ejecutadas.includes('SEGUNDA'));
        assert.equal(liberadas, 1);
        await entorno.pool.query('SEGUNDA');
        await entorno.esperarLiberaciones();
        assert.ok(ejecutadas.includes('SEGUNDA'));
        assert.equal(liberadas, 2);
        await entorno.conConexion(async () => {
            await assert.rejects(entorno.conInterceptor(() => {}, async () => {}), /exclusivo/);
            await assert.rejects(entorno.esperarLiberaciones(), /pendientes/);
        });
    } finally { await entorno.cerrar(); }
    assert.equal(cerradas, 1);
});
