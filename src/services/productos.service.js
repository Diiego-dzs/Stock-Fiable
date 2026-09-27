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

async function crearProducto(datos) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const resultado = await conexion.query(`
            INSERT INTO productos (
                codigo,
                nombre,
                descripcion,
                marca,
                categoria_id,
                precio_compra,
                precio_venta,
                stock_minimo,
                estado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            datos.codigo,
            datos.nombre,
            datos.descripcion,
            datos.marca,
            datos.categoria_id,
            datos.precio_compra,
            datos.precio_venta,
            datos.stock_minimo,
            datos.estado
        ]);

        const nuevoId = Number(resultado.insertId);

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
            WHERE p.id = ?
        `, [nuevoId]);

        return productos[0];

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
    crearProducto,
    obtenerStockPorProducto,
    obtenerLotesPorProducto
};