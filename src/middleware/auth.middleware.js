const jwt = require('jsonwebtoken');
const { obtenerUsuarioAutenticado } = require('../services/usuarios.service');

async function autenticar(req, res, next) {
    try {
        const authorization =
            req.headers.authorization;

        if (!authorization) {
            return res.status(401).json({
                error: 'Token de autenticación requerido'
            });
        }

        const partes = authorization.split(' ');

        if (
            partes.length !== 2 ||
            partes[0] !== 'Bearer'
        ) {
            return res.status(401).json({
                error: 'Formato de token inválido'
            });
        }

        const token = partes[1];

        const usuario =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        let actual;
        try {
            actual = await obtenerUsuarioAutenticado(usuario.id);
        } catch {
            return res.status(503).json({ error: 'No se pudo verificar la sesión. Intentá nuevamente.' });
        }
        if (!actual || !actual.activo) {
            return res.status(401).json({ error: 'Cuenta inactiva o inexistente' });
        }
        // Use the database role, never a stale role carried by an existing token.
        req.usuario = actual;

        next();

    } catch (error) {
        console.error(
            'Error de autenticación:',
            error.message
        );

        return res.status(401).json({
            error: 'Token inválido o expirado'
        });
    }
}

module.exports = {
    autenticar
};
