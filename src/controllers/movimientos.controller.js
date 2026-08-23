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

       if (
            producto_id === undefined ||
            producto_id === null ||
            cantidad === undefined ||
            cantidad === null ||
            lote_id === undefined ||
            lote_id === null
        ) {
            return res.status(400).json({
                error: 'producto_id, lote_id y cantidad son obligatorios'
            });
        }

        if (!motivo || !motivo.trim()) {
            return res.status(400).json({
                error: 'El motivo es obligatorio'
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

       if (
            producto_id === undefined ||
            producto_id === null ||
            cantidad === undefined ||
            cantidad === null
        ) {
            return res.status(400).json({
                error: 'producto_id y cantidad son obligatorios'
            });
        }

        if (!motivo || !motivo.trim()) {
            return res.status(400).json({
                error: 'El motivo es obligatorio'
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

async function obtenerMovimientos(req, res) {
    try {
        const {
            tipo,
            producto_id,
            fecha_desde,
            fecha_hasta,
            page,
            limite
        } = req.query;

        if (
            tipo &&
            tipo !== 'ENTRADA' &&
            tipo !== 'SALIDA'
        ) {
            return res.status(400).json({
                error: 'El tipo debe ser ENTRADA o SALIDA'
            });
        }

        if (producto_id !== undefined) {
            const productoIdNumero = Number(producto_id);

            if (
                !Number.isInteger(productoIdNumero) ||
                productoIdNumero <= 0
            ) {
                return res.status(400).json({
                    error: 'producto_id debe ser un número entero mayor que cero'
                });
            }
        }
        
        if (fecha_desde && isNaN(Date.parse(fecha_desde))) {
            return res.status(400).json({
                error: 'fecha_desde no es una fecha válida'
            });
        }

        if (fecha_hasta && isNaN(Date.parse(fecha_hasta))) {
            return res.status(400).json({
                error: 'fecha_hasta no es una fecha válida'
            });
        }

        if (page !== undefined) {
            const paginaNumero = Number(page);

            if (
                !Number.isInteger(paginaNumero) ||
                paginaNumero <= 0
            ) {
                return res.status(400).json({
                    error: 'page debe ser un número entero mayor que cero'
                });
            }
        }

        if (limite !== undefined) {
            const limiteNumero = Number(limite);

            if (
                !Number.isInteger(limiteNumero) ||
                limiteNumero <= 0
            ) {
                return res.status(400).json({
                    error: 'limite debe ser un número entero mayor que cero'
                });
            }

            if (limiteNumero > 100) {
                return res.status(400).json({
                    error: 'limite no puede ser mayor que 100'
                });
            }
        }

        const movimientos =
            await movimientosService.obtenerMovimientos({
                tipo,
                producto_id,
                fecha_desde,
                fecha_hasta,
                pagina: page,
                limite
            });

        res.json(movimientos);

    } catch (error) {
        console.error(
            'Error al obtener movimientos:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener los movimientos'
        });
    }
}

async function obtenerMovimientosPorProducto(req, res) {
    try {
        const { productoId } = req.params;

        const movimientos =
            await movimientosService.obtenerMovimientosPorProducto(
                productoId
            );

        res.json(movimientos);

    } catch (error) {
        console.error(
            'Error al obtener movimientos del producto:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener los movimientos del producto'
        });
    }
}

async function obtenerMovimientoPorId(req, res) {
    try {
        const { movimientoId } = req.params;

        const resultado =
            await movimientosService.obtenerMovimientoPorId(
                movimientoId
            );

        res.json(resultado);

    } catch (error) {
        console.error(
            'Error al obtener movimiento:',
            error.message
        );

        if (error.message === 'Movimiento no encontrado') {
            return res.status(404).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: 'Error al obtener el movimiento'
        });
    }
}

module.exports = {
    registrarEntrada,
    registrarSalida,
    obtenerMovimientos,
    obtenerMovimientosPorProducto,
    obtenerMovimientoPorId
};