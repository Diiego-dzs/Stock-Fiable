const esperado = require('./demo-esquema.esperado');

function entero(valor) {
    if (typeof valor === 'number' && !Number.isSafeInteger(valor)) throw new Error('Metadato entero inválido');
    if (!['number', 'bigint', 'string'].includes(typeof valor) || !/^\d+$/.test(String(valor))) throw new Error('Metadato entero inválido');
    return BigInt(valor).toString();
}
function numerico(valor) {
    const m = String(valor).match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
    if (!m) return { clase: 'no-numerico' };
    const parte = BigInt(m[2]).toString(), decimal = (m[3] || '').replace(/0+$/, '');
    const cero = parte === '0' && !decimal;
    return { clase: 'numero', valor: (m[1] === '-' && !cero ? '-' : '') + parte + (decimal ? '.' + decimal : '') };
}
function tipo(valor) {
    return String(valor).toLowerCase().trim().replace(/\s+/g, ' ')
        .replace(/\b(tinyint|int)\(\d+\)/g, '$1').replace(/^datetime\(0\)$/, 'datetime');
}
function defecto(valor, tipoColumna) {
    // MariaDB metadata uses bare NULL for SQL NULL and quoted 'NULL' for a literal string.
    if (valor === null || valor === 'NULL') return null;
    if (valor === undefined) return { clase: 'ausente' };
    let t = String(valor);
    const quoted = t.startsWith("'") && t.endsWith("'");
    if (quoted) t = t.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    if (/^(int|tinyint|decimal)/.test(tipoColumna)) return numerico(t);
    if (/^datetime/.test(tipoColumna) && !quoted) {
        const m = t.match(/^current_timestamp(?:\((\d*)\))?$/i);
        if (m) return { clase: 'timestamp', valor: entero(m[1] || '0') };
    }
    return { clase: 'texto', valor: t }; // Preserve case and whitespace of string literals.
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nombreSeguro = n => /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(n || '') ? n : '[identificador omitido]';
function valorSeguro(valor) {
    if (valor === null || typeof valor === 'boolean' || typeof valor === 'number') return valor;
    if (Array.isArray(valor)) return valor.map(valorSeguro);
    if (typeof valor === 'object') {
        if (valor.clase === 'texto') return { clase: 'texto', valor: ['Dueño', 'activo', 'NULL'].includes(valor.valor) ? valor.valor : '[texto omitido]' };
        if (valor.clase === 'numero') return { clase: 'numero', valor: /^[+-]?\d+(\.\d+)?$/.test(valor.valor) ? valor.valor : '[omitido]' };
        return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, valorSeguro(v)]));
    }
    const s = String(valor);
    return /^[a-zA-Z0-9_(), .+-]{0,120}$/.test(s) ? s : '[valor omitido]';
}

// Input is metadata only. Never accepts or prints rows from application tables.
function compararMetadatos(meta) {
    const diferencias = [];
    function comparar(tabla, objeto, propiedad, exp, real) {
        if (!igual(exp, real)) diferencias.push({ tabla: nombreSeguro(tabla), objeto: nombreSeguro(objeto), propiedad,
            esperado: valorSeguro(exp), obtenido: valorSeguro(real) });
    }
    comparar('esquema', 'tablas', 'cantidad', esperado.length, meta.tablas.length);
    for (const t of esperado) {
        const actual = meta.tablas.find(r => r.TABLE_NAME === t.nombre);
        comparar(t.nombre, t.nombre, 'existencia', true, !!actual);
        if (!actual) continue;
        comparar(t.nombre, t.nombre, 'motor', t.motor.toLowerCase(), String(actual.ENGINE).toLowerCase());
        comparar(t.nombre, t.nombre, 'charset', t.charset, actual.CHARACTER_SET_NAME);
        comparar(t.nombre, t.nombre, 'collation', t.collation, actual.TABLE_COLLATION);
        comparar(t.nombre, t.nombre, 'tipo_objeto', 'BASE TABLE', actual.TABLE_TYPE);
        const columnas = meta.columnas.filter(r => r.TABLE_NAME === t.nombre).sort((a,b) => Number(entero(a.ORDINAL_POSITION)) - Number(entero(b.ORDINAL_POSITION)));
        comparar(t.nombre, t.nombre, 'orden_columnas', t.columnas.map(c => c.nombre), columnas.map(c => nombreSeguro(c.COLUMN_NAME)));
        for (const c of t.columnas) {
            const r = columnas.find(r => r.COLUMN_NAME === c.nombre);
            if (!r) continue;
            if (!['YES', 'NO'].includes(r.IS_NULLABLE)) throw new Error('Nulabilidad no reconocida');
            const tr = tipo(r.COLUMN_TYPE);
            comparar(t.nombre, c.nombre, 'tipo', c.tipo, tr);
            comparar(t.nombre, c.nombre, 'nullable', c.nullable, r.IS_NULLABLE === 'YES');
            comparar(t.nombre, c.nombre, 'default', c.defecto, defecto(r.COLUMN_DEFAULT, c.tipo));
            comparar(t.nombre, c.nombre, 'auto_increment', c.auto, /\bauto_increment\b/i.test(r.EXTRA || ''));
            comparar(t.nombre, c.nombre, 'extra', '', String(r.EXTRA || '').replace(/\bauto_increment\b/ig, '').trim());
            comparar(t.nombre, c.nombre, 'charset', c.charset, r.CHARACTER_SET_NAME);
            comparar(t.nombre, c.nombre, 'collation', c.collation, r.COLLATION_NAME);
            if (c.tipo.startsWith('decimal')) {
                comparar(t.nombre, c.nombre, 'precision', '10', entero(r.NUMERIC_PRECISION));
                comparar(t.nombre, c.nombre, 'escala', '2', entero(r.NUMERIC_SCALE));
            }
            if (c.tipo === 'datetime') comparar(t.nombre, c.nombre, 'precision_temporal', '0', entero(r.DATETIME_PRECISION));
        }
        const idx = meta.indices.filter(r => r.TABLE_NAME === t.nombre);
        comparar(t.nombre, t.nombre, 'indices', t.indices.map(i => i.nombre).sort(), [...new Set(idx.map(i => nombreSeguro(i.INDEX_NAME)))].sort());
        for (const i of t.indices) {
            const filas = idx.filter(r => r.INDEX_NAME === i.nombre).sort((a,b) => Number(entero(a.SEQ_IN_INDEX)) - Number(entero(b.SEQ_IN_INDEX)));
            comparar(t.nombre, i.nombre, 'columnas_indice', i.columnas, filas.map(r => nombreSeguro(r.COLUMN_NAME)));
            for (const r of filas) {
                comparar(t.nombre, i.nombre, 'non_unique', i.unico ? '0' : '1', entero(r.NON_UNIQUE));
                comparar(t.nombre, i.nombre, 'tipo_indice', i.tipo, String(r.INDEX_TYPE).toUpperCase());
                comparar(t.nombre, i.nombre, 'prefijo', null, r.SUB_PART == null ? null : entero(r.SUB_PART));
                comparar(t.nombre, i.nombre, 'orden_indice', 'A', r.COLLATION);
            }
        }
        const fks = meta.foraneas.filter(r => r.TABLE_NAME === t.nombre);
        comparar(t.nombre, t.nombre, 'foraneas', t.foraneas.map(f => f.nombre).sort(), [...new Set(fks.map(f => nombreSeguro(f.CONSTRAINT_NAME)))].sort());
        for (const f of t.foraneas) {
            const filas = fks.filter(r => r.CONSTRAINT_NAME === f.nombre);
            comparar(t.nombre, f.nombre, 'cantidad_columnas', 1, filas.length);
            for (const r of filas) {
                comparar(t.nombre, f.nombre, 'columna', f.campo, nombreSeguro(r.COLUMN_NAME));
                comparar(t.nombre, f.nombre, 'tabla_referida', f.tabla, nombreSeguro(r.REFERENCED_TABLE_NAME));
                comparar(t.nombre, f.nombre, 'columna_referida', f.columna, nombreSeguro(r.REFERENCED_COLUMN_NAME));
                comparar(t.nombre, f.nombre, 'base_local', true, entero(r.REFERENCIA_LOCAL) === '1');
                comparar(t.nombre, f.nombre, 'on_update', f.actualizacion, r.UPDATE_RULE);
                comparar(t.nombre, f.nombre, 'on_delete', f.borrado, r.DELETE_RULE);
            }
        }
    }
    return { valido: diferencias.length === 0, diferencias };
}

// Caller owns connection, identity checks and cleanup. Only four SELECTs on metadata.
async function verificarEsquema(conexion) {
    let meta;
    try {
        meta = {
            tablas: await conexion.query(`SELECT t.TABLE_NAME,t.ENGINE,t.TABLE_COLLATION,t.TABLE_TYPE,c.CHARACTER_SET_NAME
                FROM information_schema.TABLES t LEFT JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY c
                ON c.COLLATION_NAME=t.TABLE_COLLATION WHERE t.TABLE_SCHEMA=DATABASE()`),
            columnas: await conexion.query(`SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_TYPE,IS_NULLABLE,
                COLUMN_DEFAULT,EXTRA,CHARACTER_SET_NAME,COLLATION_NAME,NUMERIC_PRECISION,NUMERIC_SCALE,DATETIME_PRECISION
                FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()`),
            indices: await conexion.query(`SELECT TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX,NON_UNIQUE,COLUMN_NAME,INDEX_TYPE,SUB_PART,COLLATION
                FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()`),
            foraneas: await conexion.query(`SELECT k.TABLE_NAME,k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,
                k.REFERENCED_COLUMN_NAME,(k.REFERENCED_TABLE_SCHEMA=DATABASE()) AS REFERENCIA_LOCAL,r.UPDATE_RULE,r.DELETE_RULE
                FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
                ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME
                WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`)
        };
    } catch { throw new Error('No se pudieron leer metadatos del esquema; detalle del driver omitido'); }
    try { return compararMetadatos(meta); }
    catch { throw new Error('Metadatos estructurales incompletos o no reconocidos; no se confirma compatibilidad'); }
}
module.exports = { verificarEsquema, compararMetadatos, defecto, tipo, entero };
