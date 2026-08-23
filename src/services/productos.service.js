const pool = require('../config/db');

async function obtenerProductos() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const productos = await conexion.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.marca,
                p.categoria_id,
                c.nombre AS categoria,
                p.precio_compra,
                p.precio_venta,
                p.stock_minimo,
                p.estado
            FROM productos p
            INNER JOIN categorias c
                ON c.id = p.categoria_id
            ORDER BY p.nombre
        `);

        return productos;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerStockPorProducto(productoId) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const producto = await conexion.query(`
            SELECT
                id,
                codigo,
                nombre,
                stock_minimo,
                estado
            FROM productos
            WHERE id = ?
        `, [productoId]);

        if (producto.length === 0) {
            return null;
        }

        const lotes = await conexion.query(`
            SELECT
                id,
                codigo_lote,
                fecha_vencimiento,
                stock_actual,
                estado
            FROM lotes
            WHERE producto_id = ?
            ORDER BY fecha_vencimiento ASC, id ASC
        `, [productoId]);

        const stockTotal = lotes.reduce(
            (total, lote) => total + Number(lote.stock_actual),
            0
        );

        return {
            producto: producto[0],
            stock_total: stockTotal,
            lotes
        };

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerLotesPorProducto(productoId) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const lotes = await conexion.query(`
            SELECT
                id,
                producto_id,
                codigo_lote,
                fecha_vencimiento,
                stock_actual,
                estado
            FROM lotes
            WHERE producto_id = ?
            ORDER BY fecha_vencimiento ASC, id ASC
        `, [productoId]);

        return lotes;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    obtenerProductos,
    obtenerStockPorProducto,
    obtenerLotesPorProducto
};