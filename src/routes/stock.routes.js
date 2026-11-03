const express = require('express');

const stockController =
    require('../controllers/stock.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const router = express.Router();
const { permitirRoles } = require('../middleware/rol.middleware');
const { ROLES } = require('../config/roles');

router.use(autenticar, permitirRoles(...ROLES));

router.get(
    '/alertas',
    stockController.obtenerAlertasStock
);

router.get(
    '/resumen',
    stockController.obtenerResumenStock
);

router.get(
    '/vencimientos',
    stockController.obtenerVencimientos
);

router.get(
    '/alertas-vencimiento',
    stockController.obtenerAlertasVencimiento
);

router.get(
    '/',
    stockController.obtenerStockGeneral
);

module.exports = router;
