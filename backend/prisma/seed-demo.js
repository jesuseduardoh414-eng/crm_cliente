// Datos de muestra de TODO el sistema, con una historia coherente de renta de
// maquinaria con operadores: equipo por áreas, obras con sus tareas, maquinaria
// asignada con operador, panel de noticias, agenda, comentarios y actividad.
//
// Es idempotente y desechable: borra lo suyo y lo vuelve a crear, así que se
// puede correr las veces que haga falta.
//   node prisma/seed-demo.js            -> siembra
//   node prisma/seed-demo.js --limpiar  -> borra solo lo de demo
//
// Requiere que exista el ADMIN: corre antes `npm run seed`.

require('dotenv/config');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Todo lo de demo cuelga de estos dominios/nombres, y es lo que borra --limpiar.
const DOMINIO_DEMO = '@demo.local';
const PASSWORD_DEMO = process.env.SEED_DEMO_PASSWORD || 'Demo.2026.local';

const dias = (n) => new Date(Date.now() + n * 86400000);
const hora = (n, h) => {
  const d = dias(n);
  d.setHours(h, 0, 0, 0);
  return d;
};

// ── El equipo ──────────────────────────────────────────────────────────────
const EQUIPO = [
  // Sofía lleva ADMINISTRACION, así que su mesa directiva administra toda la
  // casa; Laura preside el consejo (ve todo, supervisa); el resto, federación.
  { nombre: 'Sofía Ibarra',    email: `sofia${DOMINIO_DEMO}`,    area: 'ADMINISTRACION', rol: 'MESA_DIRECTIVA', puesto: 'Administración' },
  { nombre: 'Laura Medina',    email: `laura${DOMINIO_DEMO}`,    area: 'VENTAS',         rol: 'CONSEJO',       puesto: 'Consejera' },
  { nombre: 'Ricardo Salas',   email: `ricardo${DOMINIO_DEMO}`,  area: 'ALMACEN',        rol: 'FEDERACION',    puesto: 'Jefe de almacén' },
  { nombre: 'Paty Cruz',       email: `paty${DOMINIO_DEMO}`,     area: 'COMPRAS',        rol: 'FEDERACION',    puesto: 'Compradora' },
  { nombre: 'Miguel Ángel Ruiz', email: `miguel${DOMINIO_DEMO}`, area: 'RENTA',          rol: 'FEDERACION',    puesto: 'Coordinador de renta' },
  { nombre: 'Beto Fuentes',    email: `beto${DOMINIO_DEMO}`,     area: 'TALLER',         rol: 'FEDERACION',    puesto: 'Mecánico' },
];

// ── El catálogo de operadores ──────────────────────────────────────────────
// Fichas, no cuentas: los sube quien los conoce y no entran al panel.
const OPERADORES = [
  { nombre: 'Juan Herrera', especialidad: 'Retroexcavadora', zona: 'Zona norte', tarifaHora: 380,
    experienciaAnios: 12, telefonoContacto: '55 1234 5678', disponible: true, registradoPor: 'miguel',
    descripcion: 'Certificado en retro y minicargador. Disponible entre semana.' },
  { nombre: 'Luis Ramírez', especialidad: 'Grúa titán', zona: 'Zona sur', tarifaHora: 450,
    experienciaAnios: 8, telefonoContacto: '55 8765 4321', disponible: true, registradoPor: 'miguel',
    descripcion: 'Maniobras de izaje y montaje de estructura.' },
  { nombre: 'Chuy Ordóñez', especialidad: 'Compactadora / bailarina', zona: 'Zona centro', tarifaHora: 260,
    experienciaAnios: 5, telefonoContacto: '55 2468 1357', disponible: false, registradoPor: 'ricardo',
    descripcion: 'Actualmente en obra hasta fin de mes.' },
  { nombre: 'Nacho Peralta', especialidad: 'Tractor / motoconformadora', zona: 'Zona norte', tarifaHora: 400,
    experienciaAnios: 15, telefonoContacto: '55 1111 2222', disponible: true, registradoPor: 'laura',
    descripcion: 'Nos lo recomendó el cliente de Los Encinos. Primera obra con nosotros.' },
];

// ── Lo que el equipo opina de ellos ────────────────────────────────────────
const CALIFICACIONES = [
  { operador: 'Juan Herrera', autor: 'laura',   puntuacion: 5, recomendable: true,  comentario: 'Puntual y cuidadoso con la máquina. Lo volvería a contratar sin dudar.' },
  { operador: 'Juan Herrera', autor: 'ricardo', puntuacion: 5, recomendable: true,  comentario: 'Entrega el equipo limpio y reporta cualquier detalle.' },
  { operador: 'Juan Herrera', autor: 'beto',    puntuacion: 4, recomendable: true,  comentario: 'Buen operador. Alguna vez tuvo que esperar el diésel.' },
  { operador: 'Luis Ramírez', autor: 'laura',   puntuacion: 4, recomendable: true,  comentario: 'Maniobra impecable, aunque cobra por encima del promedio.' },
  { operador: 'Luis Ramírez', autor: 'sofia',   puntuacion: 4, recomendable: true,  comentario: 'Sin problemas con la facturación.' },
  { operador: 'Chuy Ordóñez', autor: 'laura',   puntuacion: 2, recomendable: false, comentario: 'Llegó tarde dos días seguidos a Los Encinos.' },
  { operador: 'Chuy Ordóñez', autor: 'paty',    puntuacion: 3, recomendable: false, comentario: 'Cumple, pero hay que estar encima.' },
];

const REPORTES = [
  { operador: 'Chuy Ordóñez', autor: 'ricardo', tipo: 'REPORTE', estado: 'ABIERTO',
    contenido: 'Dejó la compactadora sin combustible y sin avisar. La cuadrilla perdió media mañana.' },
  { operador: 'Chuy Ordóñez', autor: 'beto', tipo: 'OBSERVACION', estado: 'ABIERTO',
    contenido: 'Reporta las fallas tarde: la bailarina llegó al taller con el filtro deshecho.' },
  { operador: 'Luis Ramírez', autor: 'beto', tipo: 'OBSERVACION', estado: 'REVISADO',
    contenido: 'Pidió cambiar el horario de la maniobra por el permiso de vía. Quedó resuelto.' },
];

// ── El catálogo de maquinaria ──────────────────────────────────────────────
const MAQUINAS = [
  { nombre: 'Retroexcavadora CAT 420F2', tipo: 'Retroexcavadora', marca: 'Caterpillar', modelo: '420F2', anio: 2019, precioDia: 3500, ubicacion: 'Patio norte', disponible: false,
    descripcion: 'Con martillo hidráulico. Mantenimiento al día, 4.200 horas.' },
  { nombre: 'Minicargador Bobcat S570', tipo: 'Minicargador', marca: 'Bobcat', modelo: 'S570', anio: 2021, precioDia: 2400, ubicacion: 'Patio norte', disponible: true,
    descripcion: 'Incluye cucharón y horquillas.' },
  { nombre: 'Grúa titán 20 ton', tipo: 'Grúa', marca: 'Terex', modelo: 'RT230', anio: 2017, precioDia: 8900, ubicacion: 'Patio sur', disponible: false,
    descripcion: 'Requiere operador certificado. Maniobra máxima 20 toneladas.' },
  { nombre: 'Revolvedora 1 saco', tipo: 'Revolvedora', marca: 'Toyo', anio: 2022, precioDia: 450, ubicacion: 'Bodega', disponible: true,
    descripcion: 'Motor a gasolina 9 HP.' },
  { nombre: 'Compactadora Wacker WP1550', tipo: 'Compactadora', marca: 'Wacker Neuson', modelo: 'WP1550', anio: 2020, precioDia: 800, ubicacion: 'Bodega', disponible: true,
    descripcion: 'Placa vibratoria para terracería.' },
  { nombre: 'Andamio tubular (módulo)', tipo: 'Andamio', precioDia: 180, ubicacion: 'Bodega', disponible: true,
    descripcion: 'Módulo de 1.5 m con crucetas y plataforma.' },
  { nombre: 'Generador 6.5 kVA', tipo: 'Generador', marca: 'Honda', modelo: 'EM6500', anio: 2021, precioDia: 650, ubicacion: 'Bodega', disponible: true,
    descripcion: 'Arranque eléctrico, 120/240 V.' },
  { nombre: 'Rotomartillo Bosch GBH 8-45', tipo: 'Herramienta mayor', marca: 'Bosch', anio: 2023, precioDia: 320, ubicacion: 'Mostrador', disponible: true,
    descripcion: 'Para demolición ligera. Incluye 3 brocas SDS-max.' },
];

// ── Las obras y su trabajo ─────────────────────────────────────────────────
const PROYECTOS = [
  {
    nombre: 'Edificio Reforma 120', area: 'RENTA', estado: 'ACTIVO',
    descripcion: 'Renta de maquinaria y operadores para la cimentación y estructura del edificio.',
    inicio: -18, fin: 45,
    tareas: [
      { titulo: 'Levantamiento en sitio y medición', estado: 'HECHO', prioridad: 'ALTA', inicio: -18, vence: -15 },
      { titulo: 'Cotización de maquinaria al cliente', estado: 'HECHO', prioridad: 'ALTA', inicio: -15, vence: -12 },
      { titulo: 'Traslado de retroexcavadora a obra', estado: 'HECHO', prioridad: 'ALTA', inicio: -10, vence: -9, maquina: 'Retroexcavadora CAT 420F2' },
      { titulo: 'Excavación de cimientos', estado: 'EN_PROGRESO', prioridad: 'ALTA', inicio: -8, vence: 6, maquina: 'Retroexcavadora CAT 420F2' },
      { titulo: 'Maniobra de izaje de trabes', estado: 'EN_PROGRESO', prioridad: 'ALTA', inicio: -2, vence: 12, maquina: 'Grúa titán 20 ton' },
      { titulo: 'Reporte semanal de horas máquina', estado: 'PENDIENTE', prioridad: 'MEDIA', inicio: 0, vence: 3 },
      { titulo: 'Renovar póliza de seguro de la grúa', estado: 'PENDIENTE', prioridad: 'ALTA', inicio: 1, vence: -1 }, // vencida a propósito
      { titulo: 'Retiro de equipo al cierre de obra', estado: 'PENDIENTE', prioridad: 'BAJA', inicio: 40, vence: 45 },
    ],
  },
  {
    nombre: 'Casa habitación Los Encinos', area: 'RENTA', estado: 'ACTIVO',
    descripcion: 'Renta de equipo menor para obra residencial.',
    inicio: -6, fin: 20,
    tareas: [
      { titulo: 'Entrega de revolvedora y andamios', estado: 'HECHO', prioridad: 'MEDIA', inicio: -6, vence: -5, maquina: 'Revolvedora 1 saco' },
      { titulo: 'Compactado de terracería', estado: 'EN_PROGRESO', prioridad: 'MEDIA', inicio: -3, vence: 4, maquina: 'Compactadora Wacker WP1550' },
      { titulo: 'Cobrar renta de la primera quincena', estado: 'PENDIENTE', prioridad: 'ALTA', inicio: 0, vence: 2 },
      { titulo: 'Recolección de andamios', estado: 'PENDIENTE', prioridad: 'BAJA', inicio: 16, vence: 20 },
    ],
  },
  {
    nombre: 'Inventario anual de almacén', area: 'ALMACEN', estado: 'ACTIVO',
    descripcion: 'Conteo físico de existencias y depuración de material dañado.',
    inicio: -4, fin: 10,
    tareas: [
      { titulo: 'Conteo de pasillo A (herramienta)', estado: 'HECHO', prioridad: 'MEDIA', inicio: -4, vence: -2 },
      { titulo: 'Conteo de pasillo B (plomería)', estado: 'EN_PROGRESO', prioridad: 'MEDIA', inicio: -2, vence: 2 },
      { titulo: 'Conteo de pasillo C (eléctrico)', estado: 'PENDIENTE', prioridad: 'MEDIA', inicio: 2, vence: 6 },
      { titulo: 'Ajuste de existencias en sistema', estado: 'PENDIENTE', prioridad: 'ALTA', inicio: 6, vence: 10 },
    ],
  },
  {
    nombre: 'Mantenimiento preventivo de flota', area: 'TALLER', estado: 'ACTIVO',
    descripcion: 'Servicio programado a la maquinaria de renta.',
    inicio: -2, fin: 25,
    tareas: [
      { titulo: 'Servicio 250 h al minicargador', estado: 'PENDIENTE', prioridad: 'ALTA', inicio: 0, vence: 5, maquina: 'Minicargador Bobcat S570' },
      { titulo: 'Cambio de aceite hidráulico de la retro', estado: 'PENDIENTE', prioridad: 'MEDIA', inicio: 8, vence: 14, maquina: 'Retroexcavadora CAT 420F2' },
      { titulo: 'Revisión de cables de la grúa', estado: 'PENDIENTE', prioridad: 'ALTA', inicio: 10, vence: 16, maquina: 'Grúa titán 20 ton' },
    ],
  },
  {
    nombre: 'Temporada de lluvias 2026', area: 'VENTAS', estado: 'EN_PAUSA',
    descripcion: 'Campaña de impermeabilizantes y bombas de achique.',
    inicio: -30, fin: -5,
    tareas: [
      { titulo: 'Definir promoción de impermeabilizante', estado: 'HECHO', prioridad: 'MEDIA', inicio: -30, vence: -25 },
      { titulo: 'Pedido a proveedor', estado: 'HECHO', prioridad: 'ALTA', inicio: -24, vence: -20 },
    ],
  },
];

// ── Panel de noticias ──────────────────────────────────────────────────────
const PUBLICACIONES = [
  { titulo: 'Retroexcavadora CAT liberada a partir del 10 de agosto', tipo: 'MAQUINA_RENTA', maquina: 'Retroexcavadora CAT 420F2', autor: 'miguel',
    cuerpo: 'Termina en Reforma 120 el 10 de agosto. Quien tenga cliente en puerta, ya puede comprometerla a partir de esa fecha.' },
  { titulo: 'Minicargador Bobcat disponible desde hoy', tipo: 'MAQUINA_RENTA', maquina: 'Minicargador Bobcat S570', autor: 'miguel',
    cuerpo: 'Regresó de obra, ya pasó revisión. Con cucharón y horquillas.' },
  { titulo: 'Juan Herrera libre a partir del lunes', tipo: 'OPERADOR_DISPONIBLE', autor: 'miguel', operador: 'Juan Herrera',
    cuerpo: 'Termina la excavación en Reforma 120. Certificado en retro y minicargador, zona norte.' },
  { titulo: 'Luis Ramírez disponible para maniobras de izaje', tipo: 'OPERADOR_DISPONIBLE', autor: 'laura', operador: 'Luis Ramírez',
    cuerpo: 'Con certificación vigente para grúa titán hasta 20 toneladas.' },
  { titulo: 'Junta de asignación de maquinaria', tipo: 'REUNION', autor: 'laura', reunion: { dia: 2, h1: 9, h2: 10, modalidad: 'presencial', ubicacion: 'Sala de juntas' },
    cuerpo: 'Repasamos qué equipo se libera esta semana y a qué obra se manda. Vengan con sus pendientes de renta.' },
  { titulo: 'Capacitación: nuevo formato de horas máquina', tipo: 'REUNION', autor: 'sofia', reunion: { dia: 5, h1: 16, h2: 17, modalidad: 'remota', urlReunion: 'https://meet.example.com/horas' },
    cuerpo: 'Cómo llenar el reporte para que Administración pueda facturar sin ir de regreso.' },
  { titulo: 'El taller cierra el viernes por la tarde', tipo: 'AVISO', autor: 'beto',
    cuerpo: 'Mantenimiento de las instalaciones. Si necesitan servicio urgente, avisar antes del jueves.' },
  { titulo: 'Nuevo proveedor de refacciones hidráulicas', tipo: 'AVISO', autor: 'paty',
    cuerpo: 'Mejores tiempos de entrega en mangueras y sellos. Cotizaciones con Compras.' },
  { titulo: 'Recordatorio: reportar horas máquina cada viernes', tipo: 'AVISO', autor: 'sofia',
    cuerpo: 'Sin el reporte no se puede facturar la renta de la semana.' },
];

// ── Agenda ─────────────────────────────────────────────────────────────────
const EVENTOS = [
  { titulo: 'Visita a obra Reforma 120', tipo: 'evento', dia: 1, h1: 9, h2: 11, autor: 'miguel', ubicacion: 'Av. Reforma 120', modalidad: 'presencial', color: '#1f47dd' },
  { titulo: 'Junta semanal de renta', tipo: 'reunion', dia: 2, h1: 10, h2: 11, autor: 'laura', modalidad: 'remota', urlReunion: 'https://meet.example.com/renta', color: '#7c3aed' },
  { titulo: 'Entrega de equipo Los Encinos', tipo: 'evento', dia: 3, h1: 8, h2: 10, autor: 'ricardo', ubicacion: 'Fracc. Los Encinos', color: '#16a34a' },
  { titulo: 'Servicio 250 h minicargador', tipo: 'evento', dia: 5, h1: 8, h2: 13, autor: 'beto', ubicacion: 'Taller', color: '#ea580c' },
  { titulo: 'Corte de caja quincenal', tipo: 'evento', dia: 7, h1: 16, h2: 18, autor: 'sofia', color: '#facc15' },
  { titulo: 'Cita con proveedor de refacciones', tipo: 'reunion', dia: 4, h1: 12, h2: 13, autor: 'paty', modalidad: 'remota', color: '#db2777' },
];

// ── Comentarios (se reparten sobre las tareas en progreso) ─────────────────
const COMENTARIOS = [
  'Ya quedó el traslado, la máquina amaneció en sitio.',
  'El cliente pidió adelantar la maniobra al jueves. ¿Se puede?',
  'Ojo: hay que confirmar el permiso de vía antes de mover la grúa.',
  'Confirmado con el operador, sin novedad.',
  'Falta que Administración libere la factura para cerrar esto.',
  'Subo fotos del avance en cuanto vuelva de la obra.',
];

// ── Plantillas ─────────────────────────────────────────────────────────────
const PLANTILLA = {
  nombre: 'Renta de maquinaria con operador',
  descripcion: 'Flujo estándar desde la cotización hasta el retiro del equipo.',
  area: 'RENTA',
  tareas: [
    { clave: 'cotizar',   titulo: 'Cotización al cliente',            prioridad: 'ALTA',  orden: 0, offsetInicioDias: 0,  offsetVenceDias: 2 },
    { clave: 'contrato',  titulo: 'Firma de contrato y anticipo',     prioridad: 'ALTA',  orden: 1, offsetInicioDias: 2,  offsetVenceDias: 5,  dependeDeClave: 'cotizar' },
    { clave: 'traslado',  titulo: 'Traslado de equipo a obra',        prioridad: 'ALTA',  orden: 2, offsetInicioDias: 5,  offsetVenceDias: 6,  dependeDeClave: 'contrato' },
    { clave: 'operacion', titulo: 'Operación en sitio',               prioridad: 'MEDIA', orden: 3, offsetInicioDias: 6,  offsetVenceDias: 25, dependeDeClave: 'traslado' },
    { clave: 'reporte',   titulo: 'Reporte de horas máquina',         prioridad: 'MEDIA', orden: 4, offsetInicioDias: 12, offsetVenceDias: 13 },
    { clave: 'retiro',    titulo: 'Retiro de equipo y revisión',      prioridad: 'MEDIA', orden: 5, offsetInicioDias: 25, offsetVenceDias: 27, dependeDeClave: 'operacion' },
    { clave: 'factura',   titulo: 'Facturación y cobro final',        prioridad: 'ALTA',  orden: 6, offsetInicioDias: 27, offsetVenceDias: 32, dependeDeClave: 'retiro' },
  ],
};

// ── Limpieza ───────────────────────────────────────────────────────────────
async function limpiar() {
  const demo = await prisma.usuario.findMany({
    where: { email: { endsWith: DOMINIO_DEMO } },
    select: { id: true },
  });
  const ids = demo.map((u) => u.id);
  const proyectos = await prisma.proyecto.findMany({
    where: { nombre: { in: PROYECTOS.map((p) => p.nombre) } },
    select: { id: true },
  });
  const pids = proyectos.map((p) => p.id);

  const fichas = await prisma.operador.findMany({
    where: { nombre: { in: OPERADORES.map((o) => o.nombre) } },
    select: { id: true },
  });
  const oids = fichas.map((o) => o.id);

  // El orden importa: primero lo que apunta a otros.
  await prisma.asignacionMaquina.deleteMany({ where: { OR: [{ proyectoId: { in: pids } }, { operadorId: { in: oids } }] } });
  // Las tareas del panel cuelgan de su publicacion, no de un proyecto: se van
  // con ella por Cascade, pero solo si la publicacion se borra primero.
  await prisma.publicacion.deleteMany({ where: { autorId: { in: ids } } });
  await prisma.comentario.deleteMany({ where: { OR: [{ autorId: { in: ids } }, { proyectoId: { in: pids } }] } });
  await prisma.logActividad.deleteMany({ where: { proyectoId: { in: pids } } });
  await prisma.notificacion.deleteMany({ where: { OR: [{ usuarioId: { in: ids } }, { proyectoId: { in: pids } }] } });
  await prisma.tarea.deleteMany({ where: { proyectoId: { in: pids } } });
  await prisma.eventoInvitado.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.evento.deleteMany({ where: { OR: [{ usuarioId: { in: ids } }, { proyectoId: { in: pids } }] } });
  await prisma.plantillaTarea.deleteMany({ where: { plantilla: { nombre: PLANTILLA.nombre } } });
  await prisma.plantillaProyecto.deleteMany({ where: { nombre: PLANTILLA.nombre } });
  await prisma.proyecto.deleteMany({ where: { id: { in: pids } } });
  await prisma.maquina.deleteMany({ where: { nombre: { in: MAQUINAS.map((m) => m.nombre) } } });
  await prisma.diaEspecial.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.configuracionLaboral.deleteMany({ where: { usuarioId: { in: ids } } });
  // Calificaciones y reportes caen con la ficha por Cascade.
  await prisma.operador.deleteMany({ where: { id: { in: oids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });

  console.log('Datos de demo eliminados.');
}

// ── Siembra ────────────────────────────────────────────────────────────────
async function sembrar() {
  // El dueño de las obras de demo: una cuenta que administre y no sea de demo.
  const admin = await prisma.usuario.findFirst({ where: { rol: 'MESA_DIRECTIVA', email: { not: { endsWith: DOMINIO_DEMO } } } });
  if (!admin) throw new Error('No hay nadie en la mesa directiva. Corre antes: npm run seed');

  await limpiar();

  // 1. Equipo
  const hash = await bcrypt.hash(PASSWORD_DEMO, 12);
  const porEmail = {};
  for (const u of EQUIPO) {
    const creado = await prisma.usuario.create({
      data: {
        nombre: u.nombre, email: u.email, password: hash, area: u.area, rol: u.rol,
        puesto: u.puesto, estado: 'activo', verificado: true,
      },
    });
    porEmail[u.email.split('@')[0]] = creado;

    // Jornada laboral, para que la agenda tenga con qué pintar disponibilidad.
    await prisma.configuracionLaboral.create({
      data: { usuarioId: creado.id, diasLaborales: [1, 2, 3, 4, 5], horaEntrada: '08:00', horaSalida: '18:00' },
    });
  }
  const equipo = Object.values(porEmail);

  // Un par de días especiales
  await prisma.diaEspecial.create({ data: { usuarioId: porEmail.ricardo.id, fecha: dias(3), tipo: 'vacacion', descripcion: 'Vacaciones' } });
  await prisma.diaEspecial.create({ data: { usuarioId: porEmail.beto.id, fecha: dias(9), tipo: 'permiso', descripcion: 'Permiso médico' } });

  // 1.b Fichas de operador, con lo que el equipo opina de ellas
  const operadorPorNombre = {};
  for (const o of OPERADORES) {
    const { registradoPor, ...datos } = o;
    operadorPorNombre[o.nombre] = await prisma.operador.create({
      data: { ...datos, registradoPorId: porEmail[registradoPor].id },
    });
  }

  for (const c of CALIFICACIONES) {
    await prisma.calificacionOperador.create({
      data: {
        operadorId: operadorPorNombre[c.operador].id,
        autorId: porEmail[c.autor].id,
        puntuacion: c.puntuacion,
        recomendable: c.recomendable,
        comentario: c.comentario,
      },
    });
  }

  for (const r of REPORTES) {
    await prisma.reporteOperador.create({
      data: {
        operadorId: operadorPorNombre[r.operador].id,
        autorId: porEmail[r.autor].id,
        tipo: r.tipo,
        contenido: r.contenido,
        estado: r.estado,
        ...(r.estado === 'REVISADO'
          ? { revisadoPorId: porEmail.sofia.id, revisadoEn: dias(-1) }
          : {}),
      },
    });
  }

  // 2. Maquinaria (repartida entre el coordinador de renta y el admin)
  const maquinaPorNombre = {};
  for (const [i, m] of MAQUINAS.entries()) {
    maquinaPorNombre[m.nombre] = await prisma.maquina.create({
      data: { ...m, estado: 'PUBLICADA', propietarioId: i % 3 === 0 ? porEmail.miguel.id : admin.id },
    });
  }

  // 3. Obras con sus tareas
  const proyectoPorNombre = {};
  for (const p of PROYECTOS) {
    const miembros = equipo.filter((u) => u.area === p.area || u.rol === 'ADMIN').slice(0, 4);
    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: p.nombre, descripcion: p.descripcion, area: p.area, estado: p.estado,
        creadorId: admin.id, fechaInicio: dias(p.inicio), fechaFin: dias(p.fin),
        miembros: { connect: [{ id: admin.id }, ...miembros.map((m) => ({ id: m.id }))] },
      },
    });
    proyectoPorNombre[p.nombre] = proyecto;

    for (const [i, t] of p.tareas.entries()) {
      const responsable = miembros[i % Math.max(miembros.length, 1)] || admin;
      await prisma.tarea.create({
        data: {
          titulo: t.titulo, estado: t.estado, prioridad: t.prioridad, numeroActividad: i + 1,
          proyectoId: proyecto.id, creadorId: admin.id,
          asignadoId: responsable.id,
          asignados: { connect: [{ id: responsable.id }] },
          fechaInicio: dias(t.inicio), venceEn: dias(t.vence),
          completadoEn: t.estado === 'HECHO' ? dias(t.vence) : null,
          maquinaId: t.maquina ? maquinaPorNombre[t.maquina].id : null,
        },
      });
    }

    await prisma.logActividad.create({
      data: { accion: 'CREAR_PROYECTO', descripcion: `creó el proyecto "${p.nombre}"`, usuarioId: admin.id, proyectoId: proyecto.id },
    });
  }

  // 4. Maquinaria asignada a las obras, con su operador
  const ASIGNACIONES = [
    { proyecto: 'Edificio Reforma 120', maquina: 'Retroexcavadora CAT 420F2', operador: 'Juan Herrera', inicio: -10, fin: 24, notas: 'Excavación de cimientos y nivelación.' },
    { proyecto: 'Edificio Reforma 120', maquina: 'Grúa titán 20 ton', operador: 'Luis Ramírez', inicio: -2, fin: 30, notas: 'Izaje de trabes. Requiere permiso de vía.' },
    { proyecto: 'Edificio Reforma 120', maquina: 'Generador 6.5 kVA', operador: null, inicio: -10, fin: 45, notas: 'Energía para el frente de obra.' },
    { proyecto: 'Casa habitación Los Encinos', maquina: 'Revolvedora 1 saco', operador: null, inicio: -6, fin: 20 },
    { proyecto: 'Casa habitación Los Encinos', maquina: 'Compactadora Wacker WP1550', operador: 'Chuy Ordóñez', inicio: -3, fin: 12, notas: 'Compactado de terracería.' },
    { proyecto: 'Casa habitación Los Encinos', maquina: 'Andamio tubular (módulo)', operador: null, inicio: -6, fin: 20, notas: '6 módulos.' },
  ];
  for (const a of ASIGNACIONES) {
    await prisma.asignacionMaquina.create({
      data: {
        proyectoId: proyectoPorNombre[a.proyecto].id,
        maquinaId: maquinaPorNombre[a.maquina].id,
        operadorId: a.operador ? operadorPorNombre[a.operador].id : null,
        fechaInicio: dias(a.inicio), fechaFin: dias(a.fin),
        notas: a.notas || null, creadoPorId: porEmail.miguel.id,
      },
    });
    await prisma.logActividad.create({
      data: {
        accion: 'ASIGNAR_MAQUINA', descripcion: `asignó la máquina "${a.maquina}" al proyecto`,
        usuarioId: porEmail.miguel.id, proyectoId: proyectoPorNombre[a.proyecto].id,
      },
    });
  }

  // 5. Panel de noticias.
  // Cada noticia publicada abre su tarea, y las reuniones ademas van al
  // calendario del equipo: es lo mismo que hace el panel en caliente.
  const TAREA_POR_TIPO = {
    MAQUINA_RENTA: { prefijo: 'Colocar maquinaria', prioridad: 'ALTA' },
    OPERADOR_DISPONIBLE: { prefijo: 'Asignar operador', prioridad: 'ALTA' },
    REUNION: { prefijo: 'Preparar reunión', prioridad: 'MEDIA' },
    AVISO: { prefijo: 'Dar seguimiento', prioridad: 'MEDIA' },
  };

  for (const [i, p] of PUBLICACIONES.entries()) {
    const autor = porEmail[p.autor];

    let evento = null;
    if (p.reunion) {
      evento = await prisma.evento.create({
        data: {
          titulo: p.titulo, descripcion: p.cuerpo, tipo: 'reunion',
          modalidad: p.reunion.modalidad, ubicacion: p.reunion.ubicacion || null,
          urlReunion: p.reunion.urlReunion || null,
          fechaInicio: hora(p.reunion.dia, p.reunion.h1),
          fechaFin: hora(p.reunion.dia, p.reunion.h2),
          color: '#7c3aed', usuarioId: autor.id, creadoPorId: autor.id,
          esCompartido: true, esGlobal: true, alertaMinutos: 30,
          invitados: {
            create: equipo.map((u) => ({
              usuarioId: u.id,
              estado: u.id === autor.id ? 'aceptado' : 'pendiente',
            })),
          },
        },
      });
    }

    const publicacion = await prisma.publicacion.create({
      data: {
        titulo: p.titulo, cuerpo: p.cuerpo, tipo: p.tipo,
        estado: 'PUBLICADA', visibilidad: 'INTERNA',
        autorId: autor.id,
        maquinaId: p.maquina ? maquinaPorNombre[p.maquina].id : null,
        operadorId: p.operador ? operadorPorNombre[p.operador].id : null,
        eventoId: evento?.id || null,
      },
    });

    const plantilla = TAREA_POR_TIPO[p.tipo];
    // Un par ya se atendieron, para que el tablero no se vea recién estrenado.
    const estado = i === 1 ? 'HECHO' : i === 4 ? 'EN_PROGRESO' : 'PENDIENTE';
    await prisma.tarea.create({
      data: {
        titulo: `${plantilla.prefijo}: ${p.titulo}`,
        descripcion: p.cuerpo,
        prioridad: plantilla.prioridad,
        estado,
        completadoEn: estado === 'HECHO' ? dias(-1) : null,
        proyectoId: null,
        publicacionId: publicacion.id,
        creadorId: autor.id,
        maquinaId: p.maquina ? maquinaPorNombre[p.maquina].id : null,
        venceEn: evento?.fechaInicio || null,
        ...(estado === 'PENDIENTE'
          ? {}
          : { asignadoId: autor.id, asignados: { connect: [{ id: autor.id }] } }),
      },
    });
  }

  // 6. Agenda
  for (const e of EVENTOS) {
    const evento = await prisma.evento.create({
      data: {
        titulo: e.titulo, tipo: e.tipo, modalidad: e.modalidad || 'presencial',
        ubicacion: e.ubicacion || null, urlReunion: e.urlReunion || null,
        fechaInicio: hora(e.dia, e.h1), fechaFin: hora(e.dia, e.h2),
        color: e.color, usuarioId: porEmail[e.autor].id, creadoPorId: porEmail[e.autor].id,
        esCompartido: e.tipo === 'reunion', alertaMinutos: 30,
      },
    });
    // Las reuniones llevan invitados
    if (e.tipo === 'reunion') {
      const invitados = equipo.filter((u) => u.id !== porEmail[e.autor].id).slice(0, 3);
      for (const inv of invitados) {
        await prisma.eventoInvitado.create({ data: { eventoId: evento.id, usuarioId: inv.id, estado: 'pendiente' } });
      }
    }
  }

  // 7. Comentarios sobre las tareas en curso
  const enCurso = await prisma.tarea.findMany({ where: { estado: 'EN_PROGRESO' }, select: { id: true, proyectoId: true } });
  for (const [i, t] of enCurso.entries()) {
    await prisma.comentario.create({
      data: { contenido: COMENTARIOS[i % COMENTARIOS.length], autorId: equipo[i % equipo.length].id, tareaId: t.id },
    });
    await prisma.comentario.create({
      data: { contenido: COMENTARIOS[(i + 3) % COMENTARIOS.length], autorId: admin.id, tareaId: t.id },
    });
  }

  // 8. Notificaciones para el admin (lo que vería al entrar)
  const NOTIS = [
    { mensaje: 'Miguel Ángel Ruiz asignó la grúa titán a Edificio Reforma 120', tipo: 'maquinaria', actorNombre: 'Miguel Ángel Ruiz' },
    { mensaje: 'La póliza de seguro de la grúa está vencida', tipo: 'alerta', actorNombre: 'Sistema' },
    { mensaje: 'Juan Herrera quedará libre el lunes', tipo: 'operador', actorNombre: 'Miguel Ángel Ruiz' },
    { mensaje: 'Beto Fuentes comentó en "Excavación de cimientos"', tipo: 'comentario', actorNombre: 'Beto Fuentes' },
  ];
  for (const [i, n] of NOTIS.entries()) {
    await prisma.notificacion.create({
      data: { ...n, usuarioId: admin.id, leida: i > 1, proyectoId: proyectoPorNombre['Edificio Reforma 120'].id },
    });
  }

  // 9. Plantilla de proyecto
  const plantilla = await prisma.plantillaProyecto.create({
    data: {
      nombre: PLANTILLA.nombre, descripcion: PLANTILLA.descripcion, area: PLANTILLA.area,
      creadorId: admin.id,
      proyectoBaseId: proyectoPorNombre['Edificio Reforma 120'].id,
    },
  });
  for (const t of PLANTILLA.tareas) {
    await prisma.plantillaTarea.create({ data: { plantillaId: plantilla.id, ...t } });
  }

  // ── Resumen ──
  const c = async (m) => prisma[m].count();
  console.log('\nDATOS DE MUESTRA SEMBRADOS\n');
  console.log('  usuarios .............', await c('usuario'), `(${EQUIPO.length} de demo + los tuyos)`);
  console.log('  operadores ...........', await c('operador'));
  console.log('  calificaciones .......', await c('calificacionOperador'));
  console.log('  reportes .............', await c('reporteOperador'));
  console.log('  maquinas .............', await c('maquina'));
  console.log('  proyectos ............', await c('proyecto'));
  console.log('  tareas ...............', await c('tarea'), `(${await prisma.tarea.count({ where: { proyectoId: null } })} del panel)`);
  console.log('  maquinaria asignada ..', await c('asignacionMaquina'));
  console.log('  publicaciones ........', await c('publicacion'));
  console.log('  eventos de agenda ....', await c('evento'));
  console.log('  comentarios ..........', await c('comentario'));
  console.log('  notificaciones .......', await c('notificacion'));
  console.log('  plantillas ...........', await c('plantillaProyecto'));
  console.log('  actividad ............', await c('logActividad'));
  console.log(`\n  Todos los usuarios de demo entran con: ${PASSWORD_DEMO}`);
  console.log(`  Ej: sofia${DOMINIO_DEMO} (mesa directiva) · laura${DOMINIO_DEMO} (consejo) · miguel${DOMINIO_DEMO} (federación)`);
  console.log('  Los operadores son fichas del catálogo: no tienen cuenta ni entran al panel.');
  console.log('\n  Para borrar solo esto: node prisma/seed-demo.js --limpiar');
}

const accion = process.argv.includes('--limpiar') ? limpiar : sembrar;

accion()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
