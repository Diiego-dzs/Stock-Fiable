const pool = require('../config/db');

async function obtenerCategorias() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const categorias = await conexion.query(`
            SELECT
                id,
                nombre,
                descripcion
            FROM categorias
            ORDER BY nombre
        `);

        return categorias;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    obtenerCategorias
};