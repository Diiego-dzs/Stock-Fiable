const express = require('express');

const stockController =
    require('../controllers/stock.controller');

const router = express.Router();

router.get(
    '/alertas',
    stockController.obtenerAlertasStock
);

module.exports = router;