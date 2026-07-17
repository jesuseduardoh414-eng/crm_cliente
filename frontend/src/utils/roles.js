// Los roles de la federación, en un solo sitio.
//
// Misma escalera que el backend (permissions.utils.js): es de VISIBILIDAD, no
// de poder. El consejo ve todo pero no administra; la mesa directiva administra;
// la federación es el miembro de base.
//
//   CONSEJO (3)         ve todo, no toca
//   MESA_DIRECTIVA (2)  administra: invita, modera, gestiona obras
//   FEDERACION (1)      miembro de base

export const ROLES = ['CONSEJO', 'MESA_DIRECTIVA', 'FEDERACION'];

const NIVEL = { CONSEJO: 3, MESA_DIRECTIVA: 2, FEDERACION: 1 };

const rolDe = (usuario) => String(usuario?.rol || '').toUpperCase();

export const esConsejo = (usuario) => rolDe(usuario) === 'CONSEJO';
export const esMesaDirectiva = (usuario) => rolDe(usuario) === 'MESA_DIRECTIVA';
export const esFederacion = (usuario) => rolDe(usuario) === 'FEDERACION';

// Administrar: crear/editar/borrar obras, invitar, moderar. Solo la mesa.
export const puedeAdministrar = (usuario) => esMesaDirectiva(usuario);

// Ver el panel de conjunto: consejo (supervisa) y mesa (administra).
export const veTodo = (usuario) => (NIVEL[rolDe(usuario)] || 0) >= NIVEL.MESA_DIRECTIVA;

// Mesa directiva de un área concreta (no la de ADMINISTRACION, que lleva toda
// la casa). Administra solo lo suyo.
export const administraUnArea = (usuario) =>
  esMesaDirectiva(usuario) && usuario?.area !== 'ADMINISTRACION';

// Etiqueta corta para mostrar el rol.
export const ETIQUETA_ROL = {
  CONSEJO: 'Consejo',
  MESA_DIRECTIVA: 'Mesa directiva',
  FEDERACION: 'Federación',
};

export const etiquetaRol = (rol) => ETIQUETA_ROL[String(rol || '').toUpperCase()] || 'Federación';
