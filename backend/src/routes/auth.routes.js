// Rutas de autenticación
// POST /api/auth/register → registrar usuario
// POST /api/auth/login    → iniciar sesión
// GET  /api/auth/me       → obtener usuario actual (protegida)

const express        = require('express');
const { 
  register, 
  login, 
  me, 
  forgotPassword, 
  resetPassword, 
  verifyAccount,
  invitar,
  verificarInvitacion,
  aceptarInvitacion,
  reenviarInvitacion,
  listarInvitaciones,
  eliminarInvitacion
} = require('../controllers/auth.controller');
const { verificarToken }      = require('../middlewares/auth.middleware');
const { soloAdmin }           = require('../middlewares/roles.middleware');
const { authLimiter }         = require('../middlewares/rateLimit.middleware');

const router = express.Router();

// Rutas públicas (protegidas con rate limit)
router.post('/register', authLimiter, register);
router.post('/login',    authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.get('/verify/:token', verifyAccount);

// Rutas de invitación (públicas)
router.get('/invitacion/:token', verificarInvitacion);
router.post('/invitacion/:token/aceptar', aceptarInvitacion);

// Ruta protegida (requiere token JWT válido)
router.get('/me', verificarToken, me);

// Rutas de gestión de invitaciones (solo admin)
router.post('/invitar', verificarToken, soloAdmin, invitar);
router.post('/invitar/reenviar', verificarToken, soloAdmin, reenviarInvitacion);
router.get('/invitaciones', verificarToken, soloAdmin, listarInvitaciones);
router.delete('/invitaciones/:id', verificarToken, soloAdmin, eliminarInvitacion);

module.exports = router;
