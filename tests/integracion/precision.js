// Loaded without side effects. Called only by the explicitly authorized Docker runner.
const assert = require('node:assert/strict');

// Independent oracle: never round a number or reuse production validation logic.
function centavos(valor) {
    assert.equal(typeof valor, 'string', 'DECIMAL debe regresar como texto');
    assert.match(valor, /^\d+\.\d{2}$/);
    const [entero, fraccion] = valor.split('.');
    return BigInt(entero) * 100n + BigInt(fraccion);
}

async function ejecutarPrecision({ entorno, servicios, comprobar }) {
    const { movimientos, productos } = servicios;
    let secuencia = 0;
    const query = (sql, params) => entorno.pool.query(sql, params);
    async function fixture() {
        comprobar();
        const resultado = await query('INSERT INTO productos (codigo, nombre, categoria_id) VALUES (?, ?, ?)',
            ['FASE2A-' + ++secuencia, 'Producto sintético Fase 2A', 1]);
        const producto_id = Number(resultado.insertId);
        const lotes = [];
        for (const fecha of ['2099-01-01', '2099-02-01']) {
            const lote = await query('INSERT INTO lotes (producto_id, codigo_lote, fecha_vencimiento) VALUES (?, ?, ?)',
                [producto_id, 'FASE2A-' + secuencia + '-' + fecha, fecha]);
            lotes.push(Number(lote.insertId));
        }
        await entorno.esperarLiberaciones();
        return { producto_id, lotes };
    }
    async function entrada(f, cantidad, indice = 0, extra = {}) {
        comprobar();
        const resultado = await movimientos.registrarEntrada({ producto_id: f.producto_id, usuario_id: 1,
            lote_id: f.lotes[indice], cantidad, motivo: 'Prueba sintética Fase 2A', ...extra });
        await entorno.esperarLiberaciones();
        return resultado;
    }
    async function salida(f, cantidad) {
        comprobar();
        const resultado = await movimientos.registrarSalida({ producto_id: f.producto_id, usuario_id: 1,
            cantidad, motivo: 'Prueba sintética Fase 2A' });
        await entorno.esperarLiberaciones();
        return resultado;
    }
    async function snapshot(f) {
        const filas = async (sql) => Array.from(await query(sql, [f.producto_id]), fila => ({ ...fila }));
        const estado = {
            producto: await filas('SELECT * FROM productos WHERE id = ?'),
            lotes: await filas('SELECT * FROM lotes WHERE producto_id = ? ORDER BY id'),
            movimientos: await filas('SELECT * FROM movimientos_stock WHERE producto_id = ? ORDER BY id'),
            detalles: await filas(`SELECT ml.* FROM movimientos_lotes ml
                JOIN movimientos_stock m ON m.id = ml.movimiento_id WHERE m.producto_id = ? ORDER BY ml.id`)
        };
        await entorno.esperarLiberaciones();
        return estado;
    }
    async function verificar(f, esperado) {
        const estado = await snapshot(f);
        const stock = estado.lotes.reduce((s, l) => s + centavos(l.stock_actual), 0n);
        assert.equal(stock, esperado);
        let saldo = 0n;
        for (const m of estado.movimientos) {
            const detalles = estado.detalles.filter(d => d.movimiento_id === m.id);
            const cantidad = centavos(m.cantidad);
            assert.equal(detalles.reduce((s, d) => s + centavos(d.cantidad), 0n), cantidad);
            saldo += m.tipo === 'ENTRADA' ? cantidad : -cantidad;
        }
        assert.equal(saldo, stock, 'Historial y existencias deben coincidir');
        for (const l of estado.lotes) {
            const saldoLote = estado.detalles.filter(d => d.lote_id === l.id).reduce((s, d) => {
                const m = estado.movimientos.find(mov => mov.id === d.movimiento_id);
                return s + (m.tipo === 'ENTRADA' ? centavos(d.cantidad) : -centavos(d.cantidad));
            }, 0n);
            assert.equal(saldoLote, centavos(l.stock_actual));
        }
        const listado = await productos.obtenerProductos();
        await entorno.esperarLiberaciones();
        assert.equal(centavos(listado.find(p => p.id === f.producto_id).stock_actual), stock);
        const [huerfanos] = await query(`SELECT COUNT(*) AS total FROM movimientos_lotes ml
            LEFT JOIN movimientos_stock m ON m.id = ml.movimiento_id
            LEFT JOIN lotes l ON l.id = ml.lote_id WHERE m.id IS NULL OR l.id IS NULL`);
        assert.equal(BigInt(huerfanos.total), 0n);
        await entorno.esperarLiberaciones();
        return estado;
    }
    const escenarios = [
        ['0.10 + 0.20 = 0.30', async f => {
            await entrada(f, '0.10'); await entrada(f, '0.20'); await verificar(f, 30n);
        }],
        ['0.30 - 0.10 = 0.20', async f => {
            await entrada(f, '0.30'); await salida(f, '0.10'); await verificar(f, 20n);
        }],
        ['operaciones pequeñas sin residuos', async f => {
            for (let i = 0; i < 10; i++) {
                await entrada(f, '0.03'); await salida(f, '0.02');
                await verificar(f, BigInt(i + 1));
            }
        }],
        ['máximo DECIMAL y exceso de capacidad', async f => {
            await entrada(f, '99999999.99');
            const antes = await verificar(f, 9999999999n);
            await assert.rejects(entrada(f, '0.01'), e => e.status === 409);
            await entorno.esperarLiberaciones();
            assert.deepEqual(await snapshot(f), antes);
            await salida(f, '99999999.99'); await verificar(f, 0n);
        }],
        ['cantidades fuera de rango o precisión sin persistencia', async f => {
            const antes = await snapshot(f);
            for (const cantidad of ['100000000.00', '0.001', '99999999.999']) {
                await assert.rejects(entrada(f, cantidad), e => e.status === 400);
                await assert.rejects(salida(f, cantidad), e => e.status === 400);
            }
            await entorno.esperarLiberaciones(); assert.deepEqual(await snapshot(f), antes);
        }],
        ['FEFO decimal entre dos lotes', async f => {
            await entrada(f, '0.10'); await entrada(f, '0.20', 1);
            const resultado = await salida(f, '0.25');
            assert.deepEqual(resultado.lotes.map(l => l.lote_id), f.lotes);
            const estado = await verificar(f, 5n);
            assert.deepEqual(estado.lotes.map(l => l.stock_actual), ['0.00', '0.05']);
            const detalles = estado.detalles.filter(d => Number(d.movimiento_id) === resultado.movimiento_id);
            assert.deepEqual(detalles.map(d => d.cantidad), ['0.10', '0.15']);
        }]
    ];
    for (const [nombre, esSalida, actualizar] of [
        ['rollback detalle entrada y lote nuevo', false, false],
        ['rollback detalle salida', true, false],
        ['rollback segunda actualización FEFO', true, true]
    ]) escenarios.push([nombre, async f => {
        await entrada(f, '0.10'); await entrada(f, '0.20', 1);
        const antes = await verificar(f, 30n);
        const fallo = new Error('Fallo sintético Fase 2A');
        let coincidencias = 0;
        await assert.rejects(entorno.conInterceptor(async sql => {
            const normalizado = sql.replace(/\s+/g, ' ').trim();
            const coincide = actualizar ? /^UPDATE lotes SET stock_actual/.test(normalizado)
                : /^INSERT INTO movimientos_lotes/.test(normalizado);
            if (coincide && ++coincidencias === (actualizar ? 2 : 1)) throw fallo;
        }, () => esSalida ? salida(f, '0.25') : entrada(f, '0.05', 0, {
            lote_id: undefined, nuevo_lote: { codigo_lote: 'NUEVO-ROLLBACK', fecha_vencimiento: '2099-03-01' }
        })), e => e === fallo);
        assert.equal(coincidencias, actualizar ? 2 : 1, 'El fallo debe alcanzarse dentro de la transacción');
        await entorno.esperarLiberaciones();
        assert.deepEqual(await snapshot(f), antes, 'Rollback completo, incluyendo lote nuevo e historial');
        await verificar(f, 30n);
        await entrada(f, '0.01'); await salida(f, '0.01'); await verificar(f, 30n);
    }]);
    for (const [nombre, ejecutar] of escenarios) {
        comprobar();
        try { await ejecutar(await fixture()); }
        catch (error) { error.etapa = 'Fase 2A: ' + nombre; throw error; }
        console.log('OK Fase 2A: ' + nombre);
    }
    return escenarios.length;
}

module.exports = ejecutarPrecision;
module.exports.centavos = centavos;
