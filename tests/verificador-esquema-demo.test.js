const { test } = require('node:test');
const assert = require('node:assert/strict');
const esperado = require('./helpers/demo-esquema.esperado');
const { verificarEsquema, compararMetadatos, defecto, tipo, entero } = require('./helpers/verificar-esquema-demo');

function metadatos() {
    const m = { tablas: [], columnas: [], indices: [], foraneas: [] };
    for (const t of esperado) {
        m.tablas.push({ TABLE_NAME: t.nombre, ENGINE: 'InnoDB', TABLE_TYPE: 'BASE TABLE', TABLE_COLLATION: t.collation, CHARACTER_SET_NAME: t.charset });
        for (const [i,c] of t.columnas.entries()) {
            const d = c.defecto;
            m.columnas.push({ TABLE_NAME: t.nombre, COLUMN_NAME: c.nombre, ORDINAL_POSITION: BigInt(i+1),
                COLUMN_TYPE: c.tipo.replace(/^int\b/, 'int(10)').replace(/^tinyint\b/, 'tinyint(1)'),
                IS_NULLABLE: c.nullable ? 'YES' : 'NO', EXTRA: c.auto ? 'auto_increment' : '',
                COLUMN_DEFAULT: d === null ? 'NULL' : d.clase === 'texto' ? "'"+d.valor+"'" : d.clase === 'timestamp' ? 'current_timestamp()' : d.valor,
                CHARACTER_SET_NAME: c.charset, COLLATION_NAME: c.collation,
                NUMERIC_PRECISION: c.tipo.startsWith('decimal') ? 10n : null,
                NUMERIC_SCALE: c.tipo.startsWith('decimal') ? 2n : null,
                DATETIME_PRECISION: c.tipo === 'datetime' ? 0n : null });
        }
        for (const idx of t.indices) for (const [i,col] of idx.columnas.entries()) m.indices.push({ TABLE_NAME: t.nombre,
            INDEX_NAME: idx.nombre, SEQ_IN_INDEX: i+1, NON_UNIQUE: idx.unico ? 0n : 1n, COLUMN_NAME: col,
            INDEX_TYPE: 'BTREE', SUB_PART: null, COLLATION: 'A' });
        for (const f of t.foraneas) m.foraneas.push({ TABLE_NAME: t.nombre, CONSTRAINT_NAME: f.nombre,
            COLUMN_NAME: f.campo, REFERENCED_TABLE_NAME: f.tabla, REFERENCED_COLUMN_NAME: f.columna,
            REFERENCIA_LOCAL: 1n, UPDATE_RULE: f.actualizacion, DELETE_RULE: f.borrado });
    }
    return m;
}
const columna = (m, tabla, nombre) => m.columnas.find(c=>c.TABLE_NAME===tabla && c.COLUMN_NAME===nombre);
function diferencia(modificar, propiedad) {
    const m = metadatos(); modificar(m);
    const r = compararMetadatos(m);
    assert.equal(r.valido, false);
    assert.ok(r.diferencias.some(d=>d.propiedad === propiedad), JSON.stringify(r));
    for (const d of r.diferencias) assert.deepEqual(Object.keys(d), ['tabla','objeto','propiedad','esperado','obtenido']);
    return r;
}

test('esquema completo simulado admite metadatos equivalentes y orden arbitrario de filas', () => {
    const m = metadatos();
    for (const c of m.columnas) {
        c.COLUMN_TYPE = c.COLUMN_TYPE.toUpperCase();
        if (c.COLUMN_DEFAULT === 'NULL') c.COLUMN_DEFAULT = null;
        if (c.COLUMN_DEFAULT === 'current_timestamp()') c.COLUMN_DEFAULT = 'CURRENT_TIMESTAMP(0)';
        if (c.COLUMN_TYPE.startsWith('DECIMAL') && c.COLUMN_DEFAULT !== null) c.COLUMN_DEFAULT = "'+000.000'";
    }
    for (const i of m.indices) i.NON_UNIQUE = String(i.NON_UNIQUE);
    for (const lista of Object.values(m)) lista.reverse();
    assert.deepEqual(compararMetadatos(m), { valido: true, diferencias: [] });
});

test('NULL SQL se distingue de texto literal NULL y de default ausente', () => {
    assert.equal(defecto(null, 'varchar(255)'), null);
    assert.equal(defecto('NULL', 'varchar(255)'), null);
    assert.deepEqual(defecto("'NULL'", 'varchar(255)'), { clase:'texto', valor:'NULL' });
    assert.notDeepEqual(defecto(undefined, 'varchar(255)'), null);
    diferencia(m=>{columna(m,'categorias','descripcion').COLUMN_DEFAULT="'NULL'";}, 'default');
});

test('defaults numéricos equivalentes sin punto flotante incluso con valores grandes', () => {
    assert.deepEqual(defecto('000.000', 'decimal(10,2)'), defecto('0', 'decimal(10,2)'));
    assert.deepEqual(defecto("'99999999.9900'", 'decimal(10,2)'), defecto('99999999.99', 'decimal(10,2)'));
    assert.notDeepEqual(defecto('99999999.98', 'decimal(10,2)'), defecto('99999999.99', 'decimal(10,2)'));
    assert.deepEqual(defecto('-0.00', 'decimal(10,2)'), defecto('0', 'decimal(10,2)'));
    diferencia(m=>{columna(m,'productos','precio_compra').COLUMN_DEFAULT='0.01';}, 'default');
});

test('Number BigInt y texto entero se normalizan sin coerción ambigua', () => {
    assert.equal(entero(0), entero(0n)); assert.equal(entero('01'), '1');
    for (const v of [true,[],{},null,Infinity,1.2,Number.MAX_SAFE_INTEGER+1,'1e0']) assert.throws(()=>entero(v));
    const m=metadatos(); for(const i of m.indices) i.NON_UNIQUE=Number(i.NON_UNIQUE);
    assert.equal(compararMetadatos(m).valido,true);
});

test('CURRENT_TIMESTAMP conserva precisión y los textos mantienen caso y espacios', () => {
    assert.deepEqual(defecto('CURRENT_TIMESTAMP','datetime'),defecto('current_timestamp()','datetime'));
    assert.notDeepEqual(defecto('CURRENT_TIMESTAMP(6)','datetime'),defecto('CURRENT_TIMESTAMP','datetime'));
    assert.notDeepEqual(defecto("'Activo'",'varchar(20)'),defecto("'activo'",'varchar(20)'));
    assert.notDeepEqual(defecto("' activo '",'varchar(20)'),defecto("'activo'",'varchar(20)'));
    diferencia(m=>{columna(m,'usuarios','rol').COLUMN_DEFAULT="'dueño'";}, 'default');
});

test('tipo decimal preserva precisión y escala; ancho de enteros no altera semántica', () => {
    assert.equal(tipo('INT(10) UNSIGNED'),'int unsigned');
    assert.notEqual(tipo('decimal(10,3)'),tipo('decimal(10,2)'));
    diferencia(m=>{columna(m,'lotes','stock_actual').COLUMN_TYPE='decimal(12,2)';}, 'tipo');
    diferencia(m=>{columna(m,'lotes','stock_actual').NUMERIC_PRECISION=12;}, 'precision');
    diferencia(m=>{columna(m,'lotes','stock_actual').NUMERIC_SCALE=3;}, 'escala');
});

test('detecta pérdida de UNSIGNED y agregado de atributos de tipo', () => {
    diferencia(m=>{columna(m,'productos','id').COLUMN_TYPE='int(10)';}, 'tipo');
    diferencia(m=>{columna(m,'productos','id').COLUMN_TYPE='int(10) unsigned zerofill';}, 'tipo');
});

test('detecta nulabilidad, autoincremento y actualización automática no prevista', () => {
    diferencia(m=>{columna(m,'usuarios','email').IS_NULLABLE='YES';}, 'nullable');
    diferencia(m=>{columna(m,'usuarios','id').EXTRA='';}, 'auto_increment');
    diferencia(m=>{columna(m,'productos','fecha_actualizacion').EXTRA='on update current_timestamp()';}, 'extra');
    diferencia(m=>{columna(m,'productos','fecha_actualizacion').DATETIME_PRECISION=6;}, 'precision_temporal');
});

test('detecta cambio de orden, columnas omitidas y columnas adicionales', () => {
    diferencia(m=>{columna(m,'usuarios','email').ORDINAL_POSITION=1;columna(m,'usuarios','id').ORDINAL_POSITION=3;}, 'orden_columnas');
    diferencia(m=>{m.columnas=m.columnas.filter(c=>!(c.TABLE_NAME==='categorias'&&c.COLUMN_NAME==='descripcion'));}, 'orden_columnas');
    diferencia(m=>{m.columnas.push({...columna(m,'usuarios','nombre'),COLUMN_NAME:'extra',ORDINAL_POSITION:99});}, 'orden_columnas');
});

test('detecta índices ausentes, cambios UNIQUE, orden, prefijos y tipo de índice', () => {
    diferencia(m=>{m.indices=m.indices.filter(i=>i.INDEX_NAME!=='PRIMARY'||i.TABLE_NAME!=='usuarios');}, 'indices');
    diferencia(m=>{m.indices.find(i=>i.INDEX_NAME==='uk_usuarios_email').NON_UNIQUE=1n;}, 'non_unique');
    diferencia(m=>{m.indices.find(i=>i.INDEX_NAME==='uk_usuarios_email').COLUMN_NAME='nombre';}, 'columnas_indice');
    diferencia(m=>{m.indices[0].SUB_PART=5;}, 'prefijo');
    diferencia(m=>{m.indices[0].COLLATION='D';}, 'orden_indice');
    diferencia(m=>{m.indices[0].INDEX_TYPE='HASH';}, 'tipo_indice');
});

test('detecta claves foráneas distintas, ausentes y referencias fuera de la base', () => {
    diferencia(m=>{m.foraneas[0].REFERENCED_TABLE_NAME='usuarios';}, 'tabla_referida');
    diferencia(m=>{m.foraneas[0].REFERENCED_COLUMN_NAME='nombre';}, 'columna_referida');
    diferencia(m=>{m.foraneas[0].COLUMN_NAME='id';}, 'columna');
    diferencia(m=>{m.foraneas[0].REFERENCIA_LOCAL=0;}, 'base_local');
    diferencia(m=>{m.foraneas[0].DELETE_RULE='CASCADE';}, 'on_delete');
    diferencia(m=>{m.foraneas[0].UPDATE_RULE='CASCADE';}, 'on_update');
    diferencia(m=>{m.foraneas.pop();}, 'foraneas');
    diferencia(m=>{m.foraneas.push({...m.foraneas[0]});}, 'cantidad_columnas');
});

test('detecta motor, charset, collation, vistas y tablas faltantes o adicionales', () => {
    diferencia(m=>{m.tablas[0].ENGINE='MyISAM';}, 'motor');
    diferencia(m=>{m.tablas[0].CHARACTER_SET_NAME='latin1';}, 'charset');
    diferencia(m=>{m.tablas[0].TABLE_COLLATION='utf8mb4_bin';}, 'collation');
    diferencia(m=>{columna(m,'usuarios','nombre').COLLATION_NAME='utf8mb4_bin';}, 'collation');
    diferencia(m=>{m.tablas[0].TABLE_TYPE='VIEW';}, 'tipo_objeto');
    diferencia(m=>{m.tablas.pop();}, 'existencia');
    diferencia(m=>{m.tablas.push({...m.tablas[0],TABLE_NAME:'otra'});}, 'cantidad');
});

test('diagnósticos omiten predeterminados textuales desconocidos sin dejar de detectar diferencia', () => {
    const secretoSintetico='contenido-privado-simulado';
    const r=diferencia(m=>{columna(m,'usuarios','contrasena').COLUMN_DEFAULT="'"+secretoSintetico+"'";}, 'default');
    assert.ok(!JSON.stringify(r).includes(secretoSintetico));
    assert.ok(JSON.stringify(r).includes('[texto omitido]'));
});

test('adaptador ejecuta solo cuatro SELECTs de metadatos y no administra conexiones', async () => {
    const m=metadatos(), consultas=[];
    const c={ query:async sql=>{consultas.push(sql);return Object.values(m)[consultas.length-1];} };
    assert.deepEqual(await verificarEsquema(c),{valido:true,diferencias:[]});
    assert.equal(consultas.length,4);
    for(const sql of consultas){assert.match(sql.trim(),/^SELECT\b/);assert.match(sql,/information_schema\./);assert.ok(!/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/.test(sql));}
});

test('fallos del driver y metadatos inválidos no filtran errores originales', async () => {
    await assert.rejects(verificarEsquema({query:async()=>{throw new Error('secreto-simulado');}}),e=>!e.message.includes('secreto-simulado')&&!e.cause);
    const m=metadatos();m.columnas[0].ORDINAL_POSITION=true;let i=0;
    await assert.rejects(verificarEsquema({query:async()=>Object.values(m)[i++]}),/no se confirma compatibilidad/);
    const otro=metadatos();otro.columnas[0].IS_NULLABLE='desconocido';let j=0;
    await assert.rejects(verificarEsquema({query:async()=>Object.values(otro)[j++]}),/no se confirma compatibilidad/);
});
