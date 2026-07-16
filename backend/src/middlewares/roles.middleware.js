// Middleware de roles
// Verifica que el usuario autenticado tenga el rol requerido
const { esAdmin } = require('../utils/permissions.utils');

// Solo permite el paso a usuarios con rol ADMIN
const soloAdmin = (req, res, next) => {
  if (!esAdmin(req.usuario)) {
    return res.status(403).json({
      error: 'Acceso denegado: solo los administradores pueden realizar esta accion',
    });
  }
  next();
};

const soloMiembro = (req, res, next) => {
  if (esAdmin(req.usuario)) {
    return res.status(403).json({
      error: 'Acceso denegado: esta accion es solo para miembros',
    });
  }
  next();
};

module.exports = { soloAdmin, soloMiembro };
