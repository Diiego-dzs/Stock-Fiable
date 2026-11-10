const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/services/movimientos.validaciones');
let conexiones, eventos, stock, estado, fallo;
function reset() { conexiones = 0; eventos = []; stock = ['0.10', '0.20']; estado = 'activo'; fallo = false; }
require.cache[require.resolve('../src/config/db')] = { exports: { getConnection: async () => {
  conexiones++;
  return {
    beginTransaction: async () => eventos.push('begin'), commit: async () => eventos.push('commit'),
    rollback: async () => eventos.push('rollback'), release() { eventos.push('release'); },
    async query(sql, params) {
      const q = sql.replace(/\s+/g, ' ').trim(); eventos.push({ sql: q, params });
      if (q.includes('SELECT id, estado')) return [{ id: 1, estado }];
      if (q.includes('FROM lotes')) return stock.map((valor, i) => ({ id: i + 1, producto_id: 1, stock_actual: valor }));
      if (q.startsWith('UPDATE lotes') && fallo) throw new Error('detalle privado del motor SQL');
      return { insertId: 3n };
    }
  };
} } };
const service = require('../src/services/movimientos.service');
const controller = require('../src/controllers/movimientos.controller');
const base = { producto_id: 1, cantidad: 1, motivo: 'Compra', usuario_id: 2 };

test('cantidades válidas, límites y stock interno cero con centésimas exactas', () => {
  for (const [valor, esperado] of [[1,100n], [' 1.50 ',150n], [0.01,1n], ['99999999.99',9999999999n]]) assert.equal(v.centesimas(valor), esperado);
  assert.equal(v.centesimas('0.00', true), 0n);
  assert.equal(v.decimalSQL(v.centesimas('0.10') + v.centesimas('0.20')), '0.30');
});

test('rechaza precisión, tipos y formatos ambiguos sin redondear', () => {
  for (const valor of [0,-1,0.001,'1.000',true,false,null,undefined,[],[1],{},NaN,Infinity,-Infinity,'',' ','1e2','0x10','+1','1,50','.5','1.','01','1 000','100000000',0.1+0.2]) assert.throws(() => v.centesimas(valor), { status: 400 }, String(valor));
  for (const valor of [-1, '0.001', null, Infinity]) assert.throws(() => v.centesimas(valor, true), { status: 500 });
});

test('identificadores canónicos y límites sin coerción de tipos', () => {
  assert.equal(v.validarId('4294967295','id'),4294967295);
  assert.equal(v.validarId(1,'id'),1);
  for (const valor of [0,-1,1.5,'1.0',' 1','1 ','01','1e2','0x10',true,null,[],[1],{},NaN,Infinity,4294967296,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => v.validarId(valor,'id'), { status: 400 });
});

test('datos inválidos y modalidades incompatibles se rechazan antes de conectar', async () => {
  reset();
  for (const metodo of ['registrarEntrada','registrarSalida']) for (const datos of [{...base,cantidad:true},{...base,producto_id:[1]},{...base,cantidad:0.001},{...base,motivo:1},{...base,observacion:{}},null,[]]) await assert.rejects(service[metodo](datos),{status:400});
  for (const datos of [{...base},{...base,lote_id:null},{...base,lote_id:1,nuevo_lote:{}},{...base,lote_id:null,nuevo_lote:{}},{...base,nuevo_lote:null},{...base,nuevo_lote:{fecha_vencimiento:'2026-02-30'}}]) await assert.rejects(service.registrarEntrada(datos),{status:400});
  await assert.rejects(service.registrarSalida({...base,lote_id:1}),{status:400});
  assert.equal(conexiones,0);
});

test('entrada existente y nueva usan SQL decimal canónico y una transacción', async () => {
  for (const modalidad of [{lote_id:'1'},{nuevo_lote:{}}]) {
    reset(); const respuesta=await service.registrarEntrada({...base,producto_id:'1',cantidad:' 1.50 ',...modalidad});
    assert.equal(respuesta.cantidad,1.5); assert.doesNotThrow(()=>JSON.stringify(respuesta));
    assert.equal(eventos.filter(e=>e==='begin').length,1); assert.equal(eventos.filter(e=>e==='commit').length,1);
    const consultas=eventos.filter(e=>e.sql); assert.equal(consultas[0].sql,'SELECT id, estado FROM productos WHERE id = ? FOR UPDATE');
    assert.equal(consultas.find(e=>e.sql.startsWith('UPDATE lotes')).params[0],'1.50');
    assert.equal(consultas.some(e=>e.sql.startsWith('INSERT INTO lotes')),Boolean(modalidad.nuevo_lote));
  }
});

test('capacidad del lote y stock insuficiente devuelven 409 antes de insertar movimiento', async () => {
  reset(); stock=['99999999.99']; await assert.rejects(service.registrarEntrada({...base,lote_id:1,cantidad:'0.01'}),{status:409});
  assert.ok(eventos.includes('rollback')); assert.ok(!eventos.some(e=>e.sql?.startsWith('INSERT')));
  reset(); await assert.rejects(service.registrarSalida(base),{status:409}); assert.ok(!eventos.some(e=>e.sql?.startsWith('INSERT')));
  reset(); stock=['99999999.98']; assert.equal((await service.registrarEntrada({...base,lote_id:1,cantidad:'0.01'})).cantidad,0.01);
});

test('FEFO exacto conserva orden y asigna 0.10 + 0.20 sin residuos', async () => {
  reset(); const respuesta=await service.registrarSalida({...base,cantidad:'0.30'});
  assert.deepEqual(respuesta.lotes.map(l=>l.cantidad),[0.1,0.2]);
  assert.deepEqual(eventos.filter(e=>e.sql?.startsWith('UPDATE lotes')).map(e=>e.params),[['0.10',1],['0.20',2]]);
  assert.ok(eventos.some(e=>e.sql?.includes('fecha_vencimiento ASC, id ASC FOR UPDATE')));
  assert.ok(eventos.includes('commit')); assert.doesNotThrow(()=>JSON.stringify(respuesta));
});

test('fallos y productos inactivos hacen rollback y liberan conexión', async () => {
  reset(); fallo=true; await assert.rejects(service.registrarEntrada({...base,nuevo_lote:{}}));
  assert.ok(eventos.includes('rollback')); assert.ok(!eventos.includes('commit')); assert.equal(eventos.at(-1),'release');
  for (const metodo of ['registrarEntrada','registrarSalida']) {
    reset(); estado='inactivo'; await assert.rejects(service[metodo]({...base,...(metodo==='registrarEntrada'?{nuevo_lote:{}}:{})}),{status:409});
    assert.ok(!eventos.some(e=>e.sql?.startsWith('INSERT')));
  }
});

test('controlador conserva responsable autenticado y oculta fallos internos', async () => {
  async function enviar(body, entrada=true) {
    let status=200, datos; const res={status(s){status=s;return this;},json(d){datos=d;}};
    await controller[entrada?'registrarEntrada':'registrarSalida']({body,usuario:{id:2}},res); return {status,datos};
  }
  reset(); assert.equal((await enviar({...base,lote_id:true})).status,400);
  assert.equal((await enviar({...base,lote_id:1,cantidad:true})).status,400);
  assert.equal((await enviar(null)).status,400);
  reset(); assert.equal((await enviar({...base,lote_id:1,usuario_id:99})).status,201);
  assert.equal(eventos.find(e=>e.sql?.startsWith('INSERT INTO movimientos_stock')).params[1],2);
  reset(); assert.equal((await enviar(base,false)).status,409);
  reset(); fallo=true; const error=await enviar({...base,nuevo_lote:{}}); assert.equal(error.status,500); assert.equal(error.datos.error,'No se pudo registrar el movimiento');
});

test('máximo DECIMAL y operaciones enteras mantienen el contrato de respuesta', async () => {
  reset(); stock=['0.00'];
  const entrada=await service.registrarEntrada({...base,lote_id:1,cantidad:'99999999.99'});
  assert.equal(entrada.cantidad,99999999.99);
  reset(); stock=['99999999.99'];
  const salida=await service.registrarSalida({...base,cantidad:'99999999.99'});
  assert.equal(salida.cantidad,99999999.99);
  assert.deepEqual(eventos.filter(e=>e.sql?.startsWith('UPDATE lotes')).map(e=>e.params[0]),['99999999.99']);
  reset(); stock=['3.00','4.00'];
  assert.deepEqual((await service.registrarSalida({...base,cantidad:5})).lotes.map(l=>l.cantidad),[3,2]);
});

test('stocks simulados inválidos y límites de texto fallan sin commits', async () => {
  reset(); stock=['0.001'];
  await assert.rejects(service.registrarSalida({...base,cantidad:'0.01'}),{status:500});
  assert.ok(eventos.includes('rollback')); assert.ok(!eventos.includes('commit'));
  assert.ok(!eventos.some(e=>e.sql?.startsWith('INSERT')));
  reset();
  for (const datos of [{...base,lote_id:1,motivo:'x'.repeat(101)},{...base,lote_id:1,observacion:' '.repeat(256)}]) await assert.rejects(service.registrarEntrada(datos),{status:400});
  assert.equal(conexiones,0);
});
