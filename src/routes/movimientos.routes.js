const express = require('express');

const movimientosController =
    require('../controllers/movimientos.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const { permitirRoles } =
    require('../middleware/rol.middleware');

const router = express.Router();
const { ROLES, ROLES_MOVIMIENTOS } = require('../config/roles');

router.use(autenticar, permitirRoles(...ROLES));

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
    permitirRoles(...ROLES_MOVIMIENTOS),
    movimientosController.registrarEntrada
);

router.post(
    '/salida',
    permitirRoles(...ROLES_MOVIMIENTOS),
    movimientosController.registrarSalida
);

module.exports = router;
