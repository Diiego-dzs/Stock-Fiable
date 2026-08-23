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

module.exports = {
    obtenerAlertasStock
};