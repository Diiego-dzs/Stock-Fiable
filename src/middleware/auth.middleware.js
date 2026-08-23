const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
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

        req.usuario = usuario;

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
