const express = require('express');

const movimientosController =
    require('../controllers/movimientos.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const router = express.Router();

router.use(autenticar);

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