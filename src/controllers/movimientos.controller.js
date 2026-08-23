const movimientosService = require('../services/movimientos.service');

async function registrarEntrada(req, res) {
    try {
        const {
            producto_id,
            usuario_id,
            cantidad,
            motivo,
            observacion,
            lote_id
        } = req.body;

        if (!producto_id || !cantidad || !motivo || !lote_id) {
            return res.status(400).json({
                error: 'producto_id, lote_id, cantidad y motivo son obligatorios'
            });
        }

        if (Number(cantidad) <= 0) {
            return res.status(400).json({
                error: 'La cantidad debe ser mayor que cero'
            });
        }

        const movimiento =
            await movimientosService.registrarEntrada({
                producto_id: Number(producto_id),
                usuario_id: usuario_id
                    ? Number(usuario_id)
                    : null,
                cantidad: Number(cantidad),
                motivo,
                observacion,
                lote_id: Number(lote_id)
            });

        res.status(201).json({
            mensaje: 'Entrada registrada correctamente',
            movimiento
        });

    } catch (error) {
        console.error(
            'Error al registrar entrada:',
            error.message
        );

        res.status(400).json({
            error: error.message
        });
    }
}

async function registrarSalida(req, res) {
    try {
        const {
            producto_id,
            usuario_id,
            cantidad,
            motivo,
            observacion
        } = req.body;

        if (!producto_id || !cantidad || !motivo) {
            return res.status(400).json({
                error: 'producto_id, cantidad y motivo son obligatorios'
            });
        }

        if (Number(cantidad) <= 0) {
            return res.status(400).json({
                error: 'La cantidad debe ser mayor que cero'
            });
        }

        const movimiento =
            await movimientosService.registrarSalida({
                producto_id: Number(producto_id),
                usuario_id: usuario_id
                    ? Number(usuario_id)
                    : null,
                cantidad: Number(cantidad),
                motivo,
                observacion
            });

        res.status(201).json({
            mensaje: 'Salida registrada correctamente',
            movimiento
        });

    } catch (error) {
        console.error(
            'Error al registrar salida:',
            error.message
        );

        res.status(400).json({
            error: error.message
        });
    }
}

module.exports = {
    registrarEntrada,
    registrarSalida
};