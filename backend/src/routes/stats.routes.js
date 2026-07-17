const express = require('express');
const { getAdminStats, getMemberStats } = require('../controllers/stats.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloVisibilidadTotal, soloFederacion } = require('../middlewares/roles.middleware');

const router = express.Router();

// El panel de conjunto: consejo (supervisa) y mesa (administra). El consejo
// tiene que entrar aquí, no por la vista de miembro.
router.get('/admin', verificarToken, soloVisibilidadTotal, getAdminStats);
// El panel del miembro de base.
router.get('/member', verificarToken, soloFederacion, getMemberStats);

module.exports = router;
