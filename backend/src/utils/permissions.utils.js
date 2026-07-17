// Quien puede ver y quien puede tocar.
//
// Los tres roles son una escalera de VISIBILIDAD, no de poder:
//
//   CONSEJO (3)         ve todo el panel, pero no administra nada. Es un
//                       organo de supervision: mira y no toca.
//   MESA_DIRECTIVA (2)  la ejecutiva: invita, modera y gestiona las obras de
//                       su area. Es quien administra.
//   FEDERACION (1)      miembro de base: ve lo suyo y las obras donde esta.
//
// Por eso hay dos preguntas distintas y no una: `veTodo` (consejo y mesa) y
// `puedeAdministrar` (solo mesa). Confundirlas dejaria al consejo sin ver nada
// o con permiso para borrar obras.

const normalizarAreas = (value) => String(value || '')
  .split(',')
  .map((area) => area.trim())
  .filter(Boolean);

// Deben coincidir con el enum Rol del schema.
const ROLES = ['CONSEJO', 'MESA_DIRECTIVA', 'FEDERACION'];

// La escalera. Un numero y no el orden del array: comparar niveles es lo que
// hace que "de la mesa para arriba" se escriba en una linea.
const NIVEL = { CONSEJO: 3, MESA_DIRECTIVA: 2, FEDERACION: 1 };

const esRolValido = (rol) => ROLES.includes(String(rol || '').toUpperCase());

// Cualquier rol desconocido cae a FEDERACION, que es el menos privilegiado.
const normalizarRol = (rol) => {
  const r = String(rol || '').toUpperCase();
  return ROLES.includes(r) ? r : 'FEDERACION';
};

const nivelDe = (usuario) => NIVEL[usuario?.rol] || 0;

// "De este rol para arriba".
const alMenos = (usuario, rol) => nivelDe(usuario) >= (NIVEL[rol] || 0);

const esConsejo = (usuario) => usuario?.rol === 'CONSEJO';
const esMesaDirectiva = (usuario) => usuario?.rol === 'MESA_DIRECTIVA';

// Administrar: invitar, moderar, gestionar obras. Solo la mesa directiva.
// El consejo esta por encima en la escalera y aun asi no entra aqui: supervisa,
// no ejecuta.
const puedeAdministrar = (usuario) => esMesaDirectiva(usuario);

// Visibilidad total sobre el panel: la mesa porque lo administra, el consejo
// porque lo supervisa. No implica poder tocar nada.
const veTodo = (usuario) => alMenos(usuario, 'MESA_DIRECTIVA');

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

// La mesa directiva se reparte por areas: la de ADMINISTRACION lleva toda la
// casa, y el resto solo lo suyo.
const administraTodasLasAreas = (usuario) => puedeAdministrar(usuario) && usuario?.area === 'ADMINISTRACION';
const administraUnArea = (usuario) => puedeAdministrar(usuario) && !administraTodasLasAreas(usuario);

// Que obras alcanza a ver alguien con visibilidad global.
// El consejo no se reparte por areas: supervisa la federacion entera.
const buildScopeProyectoVisible = (usuario, campo = 'area') => {
  if (esConsejo(usuario)) return {};
  if (!puedeAdministrar(usuario)) return null;
  if (administraTodasLasAreas(usuario)) return {};
  return buildFiltroAreaProyecto(usuario.area, campo);
};

const puedeGestionarArea = (usuario, areaObjetivo) => (
  administraTodasLasAreas(usuario) || (administraUnArea(usuario) && usuario.area === areaObjetivo)
);

const puedeAdministrarProyecto = (usuario, proyecto) => {
  if (!puedeAdministrar(usuario)) return false;
  if (administraTodasLasAreas(usuario)) return true;
  return proyectoCoincideConArea(proyecto?.area, usuario.area);
};

// Ver una obra: quien tiene visibilidad global la ve, con el matiz de que la
// mesa de un area solo alcanza las suyas.
const puedeVerProyecto = (usuario, proyecto) => {
  if (esConsejo(usuario)) return true;
  return puedeAdministrarProyecto(usuario, proyecto);
};

module.exports = {
  ROLES,
  NIVEL,
  esRolValido,
  normalizarRol,
  normalizarAreas,
  nivelDe,
  alMenos,
  esConsejo,
  esMesaDirectiva,
  puedeAdministrar,
  veTodo,
  administraTodasLasAreas,
  administraUnArea,
  proyectoCoincideConArea,
  buildFiltroAreaProyecto,
  buildScopeProyectoVisible,
  puedeGestionarArea,
  puedeAdministrarProyecto,
  puedeVerProyecto,
};
