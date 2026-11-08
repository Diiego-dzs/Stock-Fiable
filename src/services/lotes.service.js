const pool = require('../config/db');
const { bloquearProductoActivo } = require('./producto-operacion');

function validarLote(datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Los datos del lote no son válidos');
    const codigo = datos.codigo_lote ?? '';
    const fecha = datos.fecha_vencimiento || null;
    if (typeof codigo !== 'string' || codigo.trim().length > 100) throw new Error('El código del lote no puede superar 100 caracteres');
    if (fecha !== null && (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha || fecha < '1000-01-01')) throw new Error('La fecha de vencimiento no es válida');
    return { codigo_lote: codigo.trim() || null, fecha_vencimiento: fecha };
}

async function insertarLote(conexion, productoId, datos) {
    const lote = validarLote(datos);
    const resultado = await conexion.query(`INSERT INTO lotes (producto_id, codigo_lote, fecha_vencimiento, stock_actual, estado) VALUES (?, ?, ?, 0, 'activo')`, [productoId, lote.codigo_lote, lote.fecha_vencimiento]);
    return { id: Number(resultado.insertId), producto_id: productoId, ...lote, stock_actual: 0, estado: 'activo' };
}

async function crearLote(productoId, datos) {
    if (!Number.isInteger(productoId) || productoId <= 0) throw new Error('El ID del producto no es válido');
    validarLote(datos);
    let conexion;
    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        await bloquearProductoActivo(conexion, productoId);
        const lote = await insertarLote(conexion, productoId, datos);
        await conexion.commit();
        return lote;
    } catch (error) {
        if (conexion) await conexion.rollback();
        throw error;
    } finally {
        if (conexion) conexion.release();
    }
}
module.exports = { validarLote, insertarLote, crearLote };
