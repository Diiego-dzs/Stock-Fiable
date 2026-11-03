const express = require('express');

const categoriasController = require('../controllers/categorias.controller');

const { autenticar } =
    require('../middleware/auth.middleware');

const router = express.Router();
const { permitirRoles } = require('../middleware/rol.middleware');
const { ROLES } = require('../config/roles');

router.use(autenticar, permitirRoles(...ROLES));

router.get('/', categoriasController.obtenerCategorias);

module.exports = router;
