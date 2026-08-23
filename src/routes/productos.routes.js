const express = require('express');

const productosController = require('../controllers/productos.controller');

const router = express.Router();

router.get('/', productosController.obtenerProductos);

router.get(
    '/:id/stock',
    productosController.obtenerStockPorProducto
);

router.get(
    '/:id/lotes',
    productosController.obtenerLotesPorProducto
);

module.exports = router;