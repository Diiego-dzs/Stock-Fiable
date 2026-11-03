
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
                p.estado,
                COALESCE(SUM(l.stock_actual), 0) AS stock_actual
            FROM productos p
            INNER JOIN categorias c
                ON c.id = p.categoria_id
            LEFT JOIN lotes l
                ON l.producto_id = p.id AND l.estado = 'activo'
            GROUP BY
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.marca,
                p.categoria_id,
                c.nombre,
                p.precio_compra,
                p.precio_venta,
                p.stock_minimo,
                p.estado
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
            (total, lote) => total + (lote.estado === 'activo' ? Number(lote.stock_actual) : 0),
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

async function crearProducto(datos) {
    const texto = (campo, max, requerido = false) => {
        const valor = datos[campo] ?? '';
        if (typeof valor !== 'string' || valor.trim().length > max || (requerido && !valor.trim())) throw new Error('El campo ' + campo + ' no es válido');
        return valor.trim() || null;
    };
    const codigo = texto('codigo', 50, true);
    const nombre = texto('nombre', 150, true);
    const descripcion = texto('descripcion', 16000);
    const marca = texto('marca', 100);
    const categoria = Number(datos.categoria_id);
    if (!Number.isInteger(categoria) || categoria <= 0) throw new Error('La categoría no es válida');
    const valores = ['precio_compra', 'precio_venta', 'stock_minimo'].map(campo => {
        const valor = datos[campo] ?? 0;
        if (!['number', 'string'].includes(typeof valor) || !/^\d+(\.\d{1,2})?$/.test(String(valor)) || !Number.isFinite(Number(valor)) || Number(valor) > 99999999.99) throw new Error('El campo ' + campo + ' debe ser un número no negativo con hasta dos decimales');
        return Number(valor);
    });
    let conexion;
    try {
        conexion = await pool.getConnection();
        const categorias = await conexion.query('SELECT id FROM categorias WHERE id = ?', [categoria]);
        if (!categorias.length) throw new Error('Categoría no encontrada');
        const resultado = await conexion.query(`INSERT INTO productos (codigo, nombre, descripcion, marca, categoria_id, precio_compra, precio_venta, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [codigo, nombre, descripcion, marca, categoria, ...valores]);
        return { id: Number(resultado.insertId), codigo, nombre, stock_actual: 0 };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) throw new Error('Ya existe un producto con ese código');
        throw error;
    } finally {
        if (conexion) conexion.release();
    }
}
module.exports.crearProducto = crearProducto;
