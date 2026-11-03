const authService = require('../services/auth.service');

async function login(req, res) {
    try {
        const {
            email,
            contrasena
        } = req.body;

        if (typeof email !== 'string' || typeof contrasena !== 'string' || !email.trim() || !contrasena || email.length > 150) {
            return res.status(400).json({
                error: 'email y contrasena son obligatorios'
            });
        }

        const resultado =
            await authService.login(
                email.trim(),
                contrasena
            );

        res.json({
            mensaje: 'Login exitoso',
            ...resultado
        });

    } catch (error) {
        console.error(
            'Error al iniciar sesión:',
            error.message
        );

        if (
            error.message === 'Credenciales inválidas' ||
            error.message === 'Usuario inactivo'
        ) {
            return res.status(401).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: 'Error al iniciar sesión'
        });
    }
}

function perfilActual(req, res) {
    const { id, nombre, email, rol, activo } = req.usuario;
    res.set('Cache-Control', 'no-store');
    res.json({ usuario: { id, nombre, email, rol, activo: Boolean(activo) } });
}
module.exports = { login, perfilActual };
