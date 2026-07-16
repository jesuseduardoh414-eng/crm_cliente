const express = require('express');
const { getAdminStats, getMemberStats } = require('../controllers/stats.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin, soloMiembro } = require('../middlewares/roles.middleware');

const router = express.Router();

// Ruta protegida solo para administradores
router.get('/admin', verificarToken, soloAdmin, getAdminStats);
router.get('/member', verificarToken, soloMiembro, getMemberStats);

module.exports = router;
