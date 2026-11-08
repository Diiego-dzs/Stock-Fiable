const express = require('express');

const productosController = require('../controllers/productos.controller');

const movimientosController =
    require('../controllers/movimientos.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const { permitirRoles } = require('../middleware/rol.middleware');
const { ROLES } = require('../config/roles');
const router = express.Router();

router.use(autenticar, permitirRoles(...ROLES));
router.post('/', permitirRoles('Dueño'), productosController.crearProducto);
router.patch('/:id/estado', permitirRoles('Dueño'), productosController.cambiarEstadoProducto);
router.patch('/:id', permitirRoles('Dueño'), productosController.editarProducto);
router.post('/:id/lotes', permitirRoles('Dueño'), productosController.crearLote);

router.get('/', productosController.obtenerProductos);

router.get(
    '/:productoId/movimientos',
    movimientosController.obtenerMovimientosPorProducto
);

router.get(
    '/:id/stock',
    productosController.obtenerStockPorProducto
);

router.get(
    '/:id/lotes',
    productosController.obtenerLotesPorProducto
);

module.exports = router;
