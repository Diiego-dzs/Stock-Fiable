const express = require('express');

const stockController =
    require('../controllers/stock.controller');

const router = express.Router();

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
    '/',
    stockController.obtenerStockGeneral
);

module.exports = router;