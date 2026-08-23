const express = require('express');

const movimientosController =
    require('../controllers/movimientos.controller');

const router = express.Router();

router.get(
    '/',
    movimientosController.obtenerMovimientos
);

router.get(
    '/:movimientoId',
    movimientosController.obtenerMovimientoPorId
);

router.post(
    '/entrada',
    movimientosController.registrarEntrada
);

router.post(
    '/salida',
    movimientosController.registrarSalida
);

module.exports = router;