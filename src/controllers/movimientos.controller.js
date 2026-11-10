const movimientosService = require('../services/movimientos.service');

async function registrar(req, res, entrada) {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Datos de movimiento inválidos' });
        const { producto_id, cantidad, motivo, observacion, lote_id, nuevo_lote } = body;
        const movimiento = await movimientosService[entrada ? 'registrarEntrada' : 'registrarSalida']({ producto_id, cantidad, motivo, observacion, lote_id, nuevo_lote, usuario_id: req.usuario.id });
        res.status(201).json({ mensaje: entrada ? 'Entrada registrada correctamente' : 'Salida registrada correctamente', movimiento });
    } catch (error) {
        const status = [400, 404, 409].includes(error.status) ? error.status : 500;
        if (status === 500) console.error('Error interno al registrar movimiento');
        res.status(status).json({ error: status === 500 ? 'No se pudo registrar el movimiento' : error.message });
    }
}
async function registrarEntrada(req, res) { return registrar(req, res, true); }
async function registrarSalida(req, res) { return registrar(req, res, false); }

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

        if (fecha_desde && fecha_hasta && fecha_desde > fecha_hasta) {
            return res.status(400).json({ error: 'fecha_desde no puede ser posterior a fecha_hasta' });
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
                limite,
                exportar: req.query.exportar === '1'
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
