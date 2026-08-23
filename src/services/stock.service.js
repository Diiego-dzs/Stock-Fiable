const pool = require('../config/db');

async function obtenerAlertasStock() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const alertas = await conexion.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.stock_minimo,
                COALESCE(SUM(l.stock_actual), 0) AS stock_actual,
                CASE
                    WHEN COALESCE(SUM(l.stock_actual), 0) = 0
                        THEN 'SIN_STOCK'
                    ELSE 'STOCK_BAJO'
                END AS alerta
            FROM productos p
            LEFT JOIN lotes l
                ON l.producto_id = p.id
                AND l.estado = 'activo'
            WHERE p.estado = 'activo'
            GROUP BY
                p.id,
                p.codigo,
                p.nombre,
                p.stock_minimo
            HAVING
                COALESCE(SUM(l.stock_actual), 0) <= p.stock_minimo
            ORDER BY
                stock_actual ASC,
                p.nombre ASC
        `);

        return alertas;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerStockGeneral() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const stock = await conexion.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.stock_minimo,
                COALESCE(SUM(l.stock_actual), 0) AS stock_actual,
                CASE
                    WHEN COALESCE(SUM(l.stock_actual), 0) = 0
                        THEN 'SIN_STOCK'
                    WHEN COALESCE(SUM(l.stock_actual), 0) <= p.stock_minimo
                        THEN 'STOCK_BAJO'
                    ELSE 'STOCK_NORMAL'
                END AS estado_stock
            FROM productos p
            LEFT JOIN lotes l
                ON l.producto_id = p.id
                AND l.estado = 'activo'
            WHERE p.estado = 'activo'
            GROUP BY
                p.id,
                p.codigo,
                p.nombre,
                p.stock_minimo
            ORDER BY
                p.nombre ASC
        `);

        return stock;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

    async function obtenerResumenStock() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const resultado = await conexion.query(`
            SELECT
                COUNT(*) AS total_productos,

                SUM(
                    CASE
                        WHEN COALESCE(stock_actual, 0) = 0
                        THEN 1
                        ELSE 0
                    END
                ) AS productos_sin_stock,

                SUM(
                    CASE
                        WHEN COALESCE(stock_actual, 0) > 0
                         AND COALESCE(stock_actual, 0) <= stock_minimo
                        THEN 1
                        ELSE 0
                    END
                ) AS productos_stock_bajo,

                SUM(
                    CASE
                        WHEN COALESCE(stock_actual, 0) > stock_minimo
                        THEN 1
                        ELSE 0
                    END
                ) AS productos_stock_normal,

                COALESCE(
                    SUM(stock_actual),
                    0
                ) AS unidades_totales

            FROM (
                SELECT
                    p.id,
                    p.stock_minimo,
                    COALESCE(
                        SUM(l.stock_actual),
                        0
                    ) AS stock_actual
                FROM productos p
                LEFT JOIN lotes l
                    ON l.producto_id = p.id
                    AND l.estado = 'activo'
                WHERE p.estado = 'activo'
                GROUP BY
                    p.id,
                    p.stock_minimo
            ) AS resumen
        `);

       const resumen = resultado[0];

        return {
            total_productos: Number(resumen.total_productos),
            productos_sin_stock: Number(resumen.productos_sin_stock),
            productos_stock_bajo: Number(resumen.productos_stock_bajo),
            productos_stock_normal: Number(resumen.productos_stock_normal),
            unidades_totales: Number(resumen.unidades_totales)
        };

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

    async function obtenerVencimientos() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const vencimientos = await conexion.query(`
            SELECT
                l.id,
                l.producto_id,
                p.codigo,
                p.nombre AS producto,
                l.codigo_lote,
                l.fecha_vencimiento,
                l.stock_actual,
                CASE
                    WHEN l.fecha_vencimiento < CURDATE()
                        THEN 'VENCIDO'
                    WHEN l.fecha_vencimiento = CURDATE()
                        THEN 'VENCE_HOY'
                    WHEN l.fecha_vencimiento <= DATE_ADD(
                        CURDATE(),
                        INTERVAL 30 DAY
                    )
                        THEN 'VENCE_PRONTO'
                    ELSE 'VIGENTE'
                END AS estado_vencimiento
            FROM lotes l
            INNER JOIN productos p
                ON p.id = l.producto_id
            WHERE
                l.estado = 'activo'
                AND l.stock_actual > 0
                AND l.fecha_vencimiento IS NOT NULL
            ORDER BY
                l.fecha_vencimiento ASC,
                l.id ASC
        `);

        return vencimientos;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    obtenerAlertasStock,
    obtenerStockGeneral,
    obtenerResumenStock,
    obtenerVencimientos
};