// Middleware de roles.
//
// Tres puertas, no una, porque los roles separan ver de administrar:
//   soloMesaDirectiva  → acciones que cambian cosas (invitar, crear obras…)
//   soloVisibilidadTotal → paneles de conjunto (consejo y mesa)
//   soloFederacion     → el panel del miembro de base
const { puedeAdministrar, veTodo } = require('../utils/permissions.utils');

// Administrar: invitar, crear/editar/borrar obras y usuarios. Solo la mesa.
const soloMesaDirectiva = (req, res, next) => {
  if (!puedeAdministrar(req.usuario)) {
    return res.status(403).json({
      error: 'Acceso denegado: solo la mesa directiva puede realizar esta acción',
    });
  }
  next();
};

// Ver el panel de conjunto: consejo (supervisa) y mesa (administra).
const soloVisibilidadTotal = (req, res, next) => {
  if (!veTodo(req.usuario)) {
    return res.status(403).json({
      error: 'Acceso denegado: este panel es de la mesa directiva y el consejo',
    });
  }
  next();
};

// El panel del miembro de base: lo ve quien no tiene visibilidad total.
const soloFederacion = (req, res, next) => {
  if (veTodo(req.usuario)) {
    return res.status(403).json({
      error: 'Acceso denegado: esta vista es para los miembros de la federación',
    });
  }
  next();
};

// Alias hacia atras: soloAdmin era exactamente esto.
module.exports = {
  soloMesaDirectiva,
  soloVisibilidadTotal,
  soloFederacion,
  soloAdmin: soloMesaDirectiva,
  soloMiembro: soloFederacion,
};
