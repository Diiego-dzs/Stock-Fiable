const express = require('express');

const authController =
    require('../controllers/auth.controller');

const router = express.Router();
const { autenticar } = require('../middleware/auth.middleware');
const { permitirRoles } = require('../middleware/rol.middleware');
const { ROLES } = require('../config/roles');
router.get('/me', autenticar, permitirRoles(...ROLES), authController.perfilActual);

router.post(
    '/login',
    authController.login
);

module.exports = router;
