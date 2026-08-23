const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function login(email, contrasena) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const usuarios = await conexion.query(`
            SELECT
                id,
                nombre,
                email,
                contrasena,
                rol,
                activo
            FROM usuarios
            WHERE email = ?
            LIMIT 1
        `, [email]);

        if (usuarios.length === 0) {
            throw new Error('Credenciales inválidas');
        }

        const usuario = usuarios[0];

        if (!usuario.activo) {
            throw new Error('Usuario inactivo');
        }

        const contrasenaValida =
            await bcrypt.compare(
                contrasena,
                usuario.contrasena
            );

        if (!contrasenaValida) {
            throw new Error('Credenciales inválidas');
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        return {
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            },
            token
        };

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    login
};
