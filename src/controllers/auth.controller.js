const authService = require('../services/auth.service');

async function login(req, res) {
    try {
        const {
            email,
            contrasena
        } = req.body;

        if (!email || !contrasena) {
            return res.status(400).json({
                error: 'email y contrasena son obligatorios'
            });
        }

        const resultado =
            await authService.login(
                email,
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

module.exports = {
    login
};
