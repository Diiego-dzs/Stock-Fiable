const express = require('express');

const movimientosController =
    require('../controllers/movimientos.controller');

const router = express.Router();

router.post(
    '/entrada',
    movimientosController.registrarEntrada
);

router.post(
    '/salida',
    movimientosController.registrarSalida
);

module.exports = router;