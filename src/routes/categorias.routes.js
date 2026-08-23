const express = require('express');

const categoriasController = require('../controllers/categorias.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const router = express.Router();

router.use(autenticar);

router.get('/', categoriasController.obtenerCategorias);

module.exports = router;