const express = require('express');

const movimientosController =
    require('../controllers/movimientos.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const { permitirRoles } =
    require('../middleware/rol.middleware');

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
    permitirRoles('Dueño'),
    movimientosController.registrarEntrada
);

router.post(
    '/salida',
    permitirRoles('Dueño'),
    movimientosController.registrarSalida
);

module.exports = router;