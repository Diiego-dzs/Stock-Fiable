const { test } = require('node:test');
const assert = require('node:assert/strict');

// Stub the pool before loading services: these tests never read .env or connect to MariaDB.
const consultas = [];
let fallar = false;
let liberadas = 0;
require.cache[require.resolve('../src/config/db')] = { exports: {
  getConnection: async () => ({
    query: async sql => { consultas.push(sql); if (fallar) throw new Error('simulado'); return []; },
    release: () => { liberadas++; }
  })
} };

test('alertas reutilizan consultas de solo lectura y liberan conexiones', async () => {
  const service = require('../src/services/stock.service');
  for (const funcion of ['obtenerAlertasStock', 'obtenerVencimientos', 'obtenerAlertasVencimiento']) {
    assert.deepEqual(await service[funcion](), []);
  }
  assert.equal(liberadas, 3);
  assert.ok(consultas.every(sql => sql.trim().startsWith('SELECT')));
  assert.match(consultas[0], /HAVING\s+COALESCE\(SUM\(l.stock_actual\), 0\) <= p.stock_minimo/);
  for (const sql of consultas.slice(1)) {
    assert.doesNotMatch(sql, /p\.estado\s*=/, 'Los vencimientos conservan productos inactivos');
    assert.match(sql, /DATEDIFF\(l.fecha_vencimiento, CURDATE\(\)\) AS dias_restantes/);
    assert.match(sql, /l.estado = 'activo'/);
    assert.match(sql, /l.stock_actual > 0/);
    assert.match(sql, /l.fecha_vencimiento IS NOT NULL/);
  }
  fallar = true;
  await assert.rejects(service.obtenerAlertasVencimiento(), /simulado/);
  assert.equal(liberadas, 4);
});

test('filtros inclusivos de 7, 15 y 30 días y categorías sin superposición', async () => {
  const { agruparAlertas, fechaVencimiento } = await import('../frontend/src/alertas.utils.js');
  const stock = [{ id: 1, alerta: 'SIN_STOCK' }, { id: 2, alerta: 'STOCK_BAJO' }];
  const vencimientos = [-1, 0, 7, 8, 15, 16, 30, 31].map(d => ({ id: d, dias_restantes: String(d), alerta: d < 0 ? 'VENCIDO' : d === 0 ? 'VENCE_HOY' : 'VENCE_PRONTO' }));
  for (const [dias, ids] of [[7, [0, 7]], [15, [0, 7, 8, 15]], [30, [0, 7, 8, 15, 16, 30]]]) {
    const grupos = agruparAlertas(stock, vencimientos, dias);
    assert.deepEqual(grupos.proximos.map(l => l.id), ids);
    assert.deepEqual(grupos.vencidos.map(l => l.id), [-1]);
    assert.equal(grupos.sinStock.length, 1);
    assert.equal(grupos.stockBajo.length, 1);
  }
  assert.deepEqual(agruparAlertas([], [], 7), { sinStock: [], stockBajo: [], proximos: [], vencidos: [] });
  assert.equal(fechaVencimiento('2026-11-02T00:00:00.000Z'), '02/11/2026');
  assert.equal(fechaVencimiento(null), '-');
});

test('rutas de alertas mantienen autenticación JWT', () => {
  const router = require('../src/routes/stock.routes');
  const { autenticar } = require('../src/middleware/auth.middleware');
  assert.equal(router.stack[0].handle, autenticar);
  const paths = router.stack.filter(l => l.route).map(l => l.route.path);
  for (const path of ['/alertas', '/vencimientos', '/alertas-vencimiento']) assert.ok(paths.includes(path));
  let status;
  autenticar({ headers: {} }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('sin token'));
  assert.equal(status, 401);
});
