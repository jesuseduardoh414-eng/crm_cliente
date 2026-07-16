const normalizarAreas = (value) => String(value || '')
  .split(',')
  .map((area) => area.trim())
  .filter(Boolean);

// Deben coincidir con el enum Rol del schema.
const ROLES = ['ADMIN', 'MIEMBRO', 'OPERADOR'];

const esRolValido = (rol) => ROLES.includes(String(rol || '').toUpperCase());

// Cualquier rol desconocido cae a MIEMBRO, que es el menos privilegiado.
// Antes esto era `rol === 'ADMIN' ? 'ADMIN' : 'MIEMBRO'`, que convertia
// silenciosamente a OPERADOR en MIEMBRO.
const normalizarRol = (rol) => {
  const r = String(rol || '').toUpperCase();
  return ROLES.includes(r) ? r : 'MIEMBRO';
};

const esAdmin = (usuario) => usuario?.rol === 'ADMIN';

const esOperador = (usuario) => usuario?.rol === 'OPERADOR';

const esAdminGlobal = (usuario) => esAdmin(usuario) && usuario?.area === 'ADMINISTRACION';

const esAdminDeArea = (usuario) => esAdmin(usuario) && !esAdminGlobal(usuario);

const proyectoCoincideConArea = (areaProyecto, areaUsuario) => {
  if (!areaUsuario) return false;
  return normalizarAreas(areaProyecto).includes(areaUsuario);
};

const buildFiltroAreaProyecto = (area, campo = 'area') => ({
  OR: [
    { [campo]: area },
    { [campo]: { startsWith: `${area},` } },
    { [campo]: { endsWith: `,${area}` } },
    { [campo]: { contains: `,${area},` } },
  ],
});

const buildScopeProyectoParaAdmin = (usuario, campo = 'area') => {
  if (!esAdmin(usuario)) return null;
  if (esAdminGlobal(usuario)) return {};
  return buildFiltroAreaProyecto(usuario.area, campo);
};

const puedeGestionarArea = (usuario, areaObjetivo) => (
  esAdminGlobal(usuario) || (esAdminDeArea(usuario) && usuario.area === areaObjetivo)
);

const puedeAdministrarProyecto = (usuario, proyecto) => {
  if (!esAdmin(usuario)) return false;
  if (esAdminGlobal(usuario)) return true;
  return proyectoCoincideConArea(proyecto?.area, usuario.area);
};

module.exports = {
  ROLES,
  esRolValido,
  normalizarRol,
  normalizarAreas,
  esAdmin,
  esOperador,
  esAdminGlobal,
  esAdminDeArea,
  proyectoCoincideConArea,
  buildFiltroAreaProyecto,
  buildScopeProyectoParaAdmin,
  puedeGestionarArea,
  puedeAdministrarProyecto,
};
