// Reuniones convocadas desde el panel de noticias.
//
// Crea el Evento que la agenda ya sabe listar: la reunion aparece en el
// calendario de cada invitado sin que el panel tenga su propio calendario.
// Vive en un servicio y no en publicaciones.controller porque son dos cosas
// distintas: publicar la noticia y convocar la reunion.

const prisma = require('../lib/prisma');
const { syncEventoToGoogle, deleteEventoFromGoogle } = require('./google-calendar.service');

// Mismo violeta que usa la agenda para las reuniones.
const COLOR_REUNION = '#7c3aed';

const parseFecha = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = invalida
};

// Best-effort: Google es un extra, y que falle no puede tumbar la reunion.
const sincronizarConGoogle = async (eventoId) => {
  try {
    await syncEventoToGoogle(eventoId);
  } catch (error) {
    console.warn('[reuniones.google.sync]', error.message);
  }
};

const borrarDeGoogle = async (evento) => {
  try {
    await deleteEventoFromGoogle(evento);
  } catch (error) {
    console.warn('[reuniones.google.delete]', error.message);
  }
};

const avisarInvitados = async (usuarioIds, creadorId, titulo, eventoId) => {
  const ids = usuarioIds.filter((id) => id !== creadorId);
  if (ids.length === 0) return;

  const creador = await prisma.usuario.findUnique({ where: { id: creadorId }, select: { nombre: true } });
  const nombre = creador?.nombre || 'Un miembro';

  try {
    await prisma.notificacion.createMany({
      data: ids.map((usuarioId) => ({
        usuarioId,
        tipo: 'recordatorio',
        mensaje: `${nombre} te ha convocado a la reunión: ${titulo}`,
        eventoId,
      })),
    });
  } catch (error) {
    console.error('[reuniones.avisar]', error);
  }
};

// A quien se convoca. Sin lista explicita, la reunion es para todo el equipo:
// en un panel interno lo normal es convocar a todos, y obligar a marcarlos uno
// a uno solo conseguiria que se olvide a alguien.
const resolverInvitados = async (invitadosIds, creadorId, esGlobal) => {
  if (esGlobal || !invitadosIds || invitadosIds.length === 0) {
    const todos = await prisma.usuario.findMany({
      where: { estado: 'activo' },
      select: { id: true },
    });
    return todos.map((u) => u.id);
  }

  const ids = [...new Set(invitadosIds.map(Number).filter(Number.isInteger))];
  const existen = await prisma.usuario.findMany({
    where: { id: { in: ids }, estado: 'activo' },
    select: { id: true },
  });
  const validos = existen.map((u) => u.id);

  // El convocante va siempre: es su reunion y tiene que verla en su calendario.
  return validos.includes(creadorId) ? validos : [...validos, creadorId];
};

/**
 * Crea la reunion en el calendario.
 * Devuelve { evento } o { error } con el motivo si los datos no cuadran.
 */
const crearReunion = async ({
  titulo,
  descripcion,
  fechaInicio,
  fechaFin,
  modalidad,
  ubicacion,
  urlReunion,
  invitadosIds,
  esGlobal,
  creadorId,
}) => {
  // El orden importa: parseFecha devuelve undefined si la fecha es basura y
  // null si no vino, y son dos errores distintos.
  const inicio = parseFecha(fechaInicio);
  if (inicio === undefined) return { error: 'La fecha de inicio de la reunión no es válida' };
  if (!inicio) return { error: 'La reunión necesita fecha y hora de inicio' };

  const fin = parseFecha(fechaFin);
  if (fin === undefined) return { error: 'La fecha de fin de la reunión no es válida' };
  if (fin && fin <= inicio) return { error: 'La reunión no puede terminar antes de empezar' };

  const idsInvitados = await resolverInvitados(invitadosIds, creadorId, esGlobal);
  const paraTodos = esGlobal || !invitadosIds || invitadosIds.length === 0;

  const evento = await prisma.evento.create({
    data: {
      usuarioId: creadorId,
      creadoPorId: creadorId,
      titulo,
      descripcion: descripcion || null,
      tipo: 'reunion',
      modalidad: modalidad || 'presencial',
      ubicacion: ubicacion || null,
      urlReunion: urlReunion || null,
      fechaInicio: inicio,
      fechaFin: fin,
      color: COLOR_REUNION,
      esCompartido: true,
      esGlobal: paraTodos,
      invitados: {
        create: idsInvitados.map((usuarioId) => ({
          usuarioId,
          // El convocante ya esta dentro; al resto se le pregunta.
          estado: usuarioId === creadorId ? 'aceptado' : 'pendiente',
        })),
      },
    },
    include: { invitados: true },
  });

  await avisarInvitados(idsInvitados, creadorId, titulo, evento.id);
  await sincronizarConGoogle(evento.id);

  return { evento };
};

/**
 * Reprograma una reunion existente. Solo toca lo que se manda.
 */
const actualizarReunion = async (eventoId, { titulo, descripcion, fechaInicio, fechaFin, modalidad, ubicacion, urlReunion }) => {
  const inicio = fechaInicio !== undefined ? parseFecha(fechaInicio) : undefined;
  if (inicio === undefined && fechaInicio !== undefined) {
    return { error: 'La fecha de inicio de la reunión no es válida' };
  }
  if (fechaInicio !== undefined && !inicio) return { error: 'La reunión necesita fecha y hora de inicio' };

  const fin = fechaFin !== undefined ? parseFecha(fechaFin) : undefined;
  if (fin === undefined && fechaFin !== undefined) {
    return { error: 'La fecha de fin de la reunión no es válida' };
  }

  const actual = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!actual) return { error: 'La reunión ya no existe' };

  const inicioFinal = inicio ?? actual.fechaInicio;
  const finFinal = fechaFin !== undefined ? fin : actual.fechaFin;
  if (finFinal && finFinal <= inicioFinal) {
    return { error: 'La reunión no puede terminar antes de empezar' };
  }

  const evento = await prisma.evento.update({
    where: { id: eventoId },
    data: {
      ...(titulo !== undefined ? { titulo } : {}),
      ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
      ...(fechaInicio !== undefined ? { fechaInicio: inicio } : {}),
      ...(fechaFin !== undefined ? { fechaFin: fin } : {}),
      ...(modalidad !== undefined ? { modalidad: modalidad || 'presencial' } : {}),
      ...(ubicacion !== undefined ? { ubicacion: ubicacion || null } : {}),
      ...(urlReunion !== undefined ? { urlReunion: urlReunion || null } : {}),
    },
  });

  await sincronizarConGoogle(evento.id);
  return { evento };
};

const cancelarReunion = async (eventoId) => {
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento) return;
  await borrarDeGoogle(evento);
  await prisma.evento.delete({ where: { id: eventoId } });
};

module.exports = { crearReunion, actualizarReunion, cancelarReunion };
