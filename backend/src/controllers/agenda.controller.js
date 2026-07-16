// Controlador de Agenda Personal y Compartida
const prisma = require('../lib/prisma');
const {
  getConnectionStatus,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  syncEventoToGoogle,
  deleteEventoFromGoogle,
} = require('../services/google-calendar.service');

const DIAS_LABORALES_DEFAULT = [1, 2, 3, 4, 5];
const TIPOS_NO_LABORALES = ['festivo', 'vacacion', 'permiso'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const COLOR_CATEGORIA = {
  tarea: '#16a34a',
  reunion: '#7c3aed',
  evento: '#2563eb',
};

const getColorCategoria = (tipo) => COLOR_CATEGORIA[tipo] || COLOR_CATEGORIA.evento;

const syncEventoBestEffort = async (eventoId) => {
  try {
    await syncEventoToGoogle(eventoId);
  } catch (error) {
    console.warn('[agenda.google.sync]', error.message);
  }
};

const deleteEventoGoogleBestEffort = async (evento) => {
  try {
    await deleteEventoFromGoogle(evento);
  } catch (error) {
    console.warn('[agenda.google.delete]', error.message);
  }
};

const getDateKeyUTC = (date) => date.toISOString().split('T')[0];
const getFinTareaParaDisponibilidad = (tarea) => (
  tarea.venceEn ? tarea.venceEn : new Date(tarea.fechaInicio.getTime() + ONE_DAY_MS)
);
const ajustarFechaTodoElDia = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    date.setUTCHours(endOfDay ? 23 : 12, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }
  return date;
};
const getGlobalHoliday = (date) => {
  const year = date.getUTCFullYear();
  const holidays = [
    { fecha: `${year}-01-01`, descripcion: 'Año Nuevo' },
    { fecha: `${year}-02-02`, descripcion: 'Día de la Constitución' },
    { fecha: `${year}-03-16`, descripcion: 'Natalicio de Benito Juárez' },
    { fecha: `${year}-05-01`, descripcion: 'Día del Trabajo' },
    { fecha: `${year}-09-16`, descripcion: 'Día de la Independencia' },
    { fecha: `${year}-09-20`, descripcion: 'Fundación de Monterrey' },
    { fecha: `${year}-11-16`, descripcion: 'Aniversario de la Revolución' },
    { fecha: `${year}-12-25`, descripcion: 'Navidad' },
  ];

  return holidays.find(holiday => holiday.fecha === getDateKeyUTC(date));
};

const validarFechaLaboral = async (usuarioId, fecha) => {
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) {
    return { valido: false, error: 'Fecha de inicio invalida' };
  }

  const config = await prisma.configuracionLaboral.findUnique({ where: { usuarioId } });
  const diasLaborales = config?.diasLaborales || DIAS_LABORALES_DEFAULT;
  const diaSemana = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

  if (!diasLaborales.includes(diaSemana)) {
    return { valido: false, error: 'No se permiten eventos en dias no laborales' };
  }

  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  const diaEspecial = await prisma.diaEspecial.findFirst({
    where: {
      usuarioId,
      fecha: { gte: start, lt: end },
      tipo: { in: TIPOS_NO_LABORALES }
    }
  });

  if (diaEspecial) {
    return { valido: false, error: `No se permiten eventos en esta fecha: ${diaEspecial.descripcion || 'dia no laboral'}` };
  }

  const feriadoGlobal = getGlobalHoliday(date);
  if (feriadoGlobal) {
    return { valido: false, error: `No se permiten eventos en esta fecha: ${feriadoGlobal.descripcion}` };
  }

  return { valido: true };
};

// €€ Utilidad: expandir evento recurrente en ocurrencias €€€€€€€€€€€€€€€€€€€€€
function expandirRecurrente(evento, desdeDate, hastaDate) {
  if (!evento.esRecurrente || !evento.patronRecurrencia) return [];
  try {
    const patron = JSON.parse(evento.patronRecurrencia);
    const diasSemana = patron.dias || []; // [0..6] domingo=0
    const horaInicio = patron.horaInicio || '00:00';
    const horaFin    = patron.horaFin    || '23:59';
    const finRecurr  = evento.fechaFinRecurr ? new Date(evento.fechaFinRecurr) : hastaDate;

    const desde = new Date(Math.max(desdeDate.getTime(), new Date(evento.fechaInicio).getTime()));
    const hasta = new Date(Math.min(hastaDate.getTime(), finRecurr.getTime()));

    const ocurrencias = [];
    const cursor = new Date(desde);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= hasta) {
      const diaSemana = cursor.getDay(); // 0=domingo
      if (diasSemana.includes(diaSemana)) {
        const [hi, mi] = horaInicio.split(':').map(Number);
        const [hf, mf] = horaFin.split(':').map(Number);
        const fi = new Date(cursor); fi.setHours(hi, mi, 0, 0);
        const ff = new Date(cursor); ff.setHours(hf, mf, 0, 0);
        ocurrencias.push({
          ...evento,
          id: `${evento.id}_${cursor.toISOString().split('T')[0]}`,
          fechaInicio: fi,
          fechaFin:    ff,
          esOcurrencia: true,
          eventoBaseId: evento.id,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return ocurrencias;
  } catch { return []; }
}

// €€ GET /api/agenda €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
// Listar eventos del usuario (propios + invitados)
const listar = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const usuarioId = req.usuario.id;

  try {
    const desde = fecha_inicio ? new Date(fecha_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const hasta = fecha_fin   ? new Date(fecha_fin)   : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);

    const where = {
      OR: [
        { usuarioId },
        { esGlobal: true },
        { invitados: { some: { usuarioId } } }
      ]
    };

    // Traer eventos normales en el rango + todos los recurrentes vigentes + tareas/proyectos
    const [eventosNormales, eventosRecurrentes, tareas, proyectos] = await Promise.all([
      // Eventos normales dentro del rango
      prisma.evento.findMany({
        where: {
          AND: [
            where,
            { fechaInicio: { lte: hasta } },
            {
              OR: [
                { fechaFin: { gte: desde } },
                { fechaFin: null, fechaInicio: { gte: desde } }
              ]
            }
          ]
        },
        include: {
          creador:   { select: { id: true, nombre: true, email: true } },
          invitados: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
          proyecto:  { select: { id: true, nombre: true } }
        },
        orderBy: { fechaInicio: 'asc' },
      }),
      // Eventos recurrentes (cualquier fecha inicio, los expandimos en JS)
      prisma.evento.findMany({
        where: { AND: [ where, { patronRecurrencia: { not: null } } ] },
        include: {
          creador:   { select: { id: true, nombre: true, email: true } },
          invitados: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
          proyecto:  { select: { id: true, nombre: true } }
        },
      }),
      // Tareas relacionadas al usuario que cruzan con el rango consultado
      prisma.tarea.findMany({
        where: {
          AND: [
            {
              OR: [
                { asignadoId: usuarioId },
                { creadorId: usuarioId },
              ],
            },
            { fechaInicio: { lte: hasta } },
            {
              OR: [
                { venceEn: { gte: desde } },
                { venceEn: null, fechaInicio: { gte: desde } }
              ]
            }
          ]
        },
        include: { proyecto: { select: { nombre: true } } }
      }),
      prisma.proyecto.findMany({
        where: {
          AND: [
            { estado: { not: 'CERRADO' } },
            { fechaInicio: { lte: hasta } },
            {
              OR: [
                { fechaFin: { gte: desde } },
                { fechaFin: null, fechaInicio: { gte: desde } },
              ],
            },
            {
              OR: [
                { miembros: { some: { id: usuarioId } } },
                { creadorId: usuarioId },
                { tareas: { some: { asignadoId: usuarioId } } },
                { tareas: { some: { creadorId: usuarioId } } },
              ],
            },
          ],
        },
        select: {
          id: true,
          nombre: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          creadoEn: true,
        },
      })
    ]);

    // Eliminar duplicados (eventos que son normales Y tienen patrón)
    const idsNormales = new Set(eventosNormales.map(e => e.id));
    const soloRecurrentes = eventosRecurrentes.filter(e => !idsNormales.has(e.id));

    // Filtrar normales que NO son recurrentes (no tienen patrón)
    const normales = eventosNormales.filter(e => !e.patronRecurrencia);

    // Mapear tareas a formato evento
    const eventosTareas = tareas.map(t => {
      // Ajuste de zona horaria: Si la fecha viene a medianoche (00:00:00),
      // al convertirla a local en México (UTC-6) se atrasa un día.
      // La ponemos a mediodía (12:00:00) para asegurar que caiga en el día correcto.
      const fechaInicio = ajustarFechaTodoElDia(t.fechaInicio);
      const fechaFin = ajustarFechaTodoElDia(t.venceEn || t.fechaInicio, true);

      return {
        id: `tarea-${t.id}`,
        titulo: `TAREA: ${t.titulo}`,
        tipo: 'tarea',
        fechaInicio,
        fechaFin,
        todoElDia: true,
        color: getColorCategoria('tarea'),
        proyecto: t.proyecto,
        esLectura: true 
      };
    });

    const eventosProyectos = proyectos.map((proyecto) => {
      const fechaInicio = ajustarFechaTodoElDia(proyecto.fechaInicio || proyecto.creadoEn);
      const fechaFin = ajustarFechaTodoElDia(proyecto.fechaFin || proyecto.fechaInicio || proyecto.creadoEn, true);

      return {
        id: `proyecto-${proyecto.id}`,
        titulo: `Proyecto: ${proyecto.nombre}`,
        tipo: 'proyecto',
        estado: proyecto.estado,
        fechaInicio,
        fechaFin,
        todoElDia: true,
        color: getColorCategoria('evento'),
        proyecto: { id: proyecto.id, nombre: proyecto.nombre },
        esLectura: true
      };
    });

    // Expandir recurrentes en el rango
    const expandidos = soloRecurrentes.flatMap(e => expandirRecurrente(e, desde, hasta));

    const resultado = [...normales, ...eventosProyectos, ...eventosTareas, ...expandidos].sort(
      (a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio)
    );

    return res.json({ eventos: resultado });
  } catch (error) {
    console.error('[agenda.listar]', error);
    return res.status(500).json({ error: 'Error al listar la agenda' });
  }
};

// €€ PUT /api/agenda/:id €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const editar = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  const { 
    titulo, descripcion, tipo, fecha_inicio, fecha_fin, todo_el_dia, color,
    alerta_minutos, es_compartido, es_global, proyecto_id,
    es_recurrente, patron_recurrencia, fecha_fin_recurrencia,
    modalidad, ubicacion, url_reunion, instrucciones_acceso
  } = req.body;

  try {
    const existente = await prisma.evento.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ error: 'Evento no encontrado' });
    if (existente.usuarioId !== usuarioId && existente.creadoPorId !== usuarioId) {
      return res.status(403).json({ error: 'No tienes permiso para editar este evento' });
    }

    const fechaInicioFinal = fecha_inicio !== undefined ? new Date(fecha_inicio) : existente.fechaInicio;
    const fechaFinFinal = fecha_fin !== undefined ? (fecha_fin ? new Date(fecha_fin) : null) : existente.fechaFin;
    if (
      fechaFinFinal &&
      !Number.isNaN(fechaInicioFinal.getTime()) &&
      !Number.isNaN(fechaFinFinal.getTime()) &&
      fechaFinFinal <= fechaInicioFinal
    ) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
    }

    const updateData = {
      titulo:           titulo       !== undefined ? titulo       : existente.titulo,
      descripcion:      descripcion  !== undefined ? descripcion  : existente.descripcion,
      tipo:             tipo         || existente.tipo,
      modalidad:        modalidad    !== undefined ? modalidad : existente.modalidad,
      ubicacion:        ubicacion    !== undefined ? (ubicacion || null) : existente.ubicacion,
      urlReunion:       url_reunion  !== undefined ? (url_reunion || null) : existente.urlReunion,
      instruccionesAcceso: instrucciones_acceso !== undefined ? (instrucciones_acceso || null) : existente.instruccionesAcceso,
      fechaInicio:      fechaInicioFinal,
      fechaFin:         fechaFinFinal,
      todoElDia:        todo_el_dia  !== undefined ? todo_el_dia  : existente.todoElDia,
      color:            getColorCategoria(tipo || existente.tipo),
      alertaMinutos:    alerta_minutos !== undefined ? (alerta_minutos !== null ? parseInt(alerta_minutos) : null) : existente.alertaMinutos,
      esCompartido:     es_compartido !== undefined ? !!es_compartido : existente.esCompartido,
      esGlobal:         es_global    !== undefined ? !!es_global   : existente.esGlobal,
      proyectoId:       proyecto_id  !== undefined ? (proyecto_id ? parseInt(proyecto_id) : null) : existente.proyectoId,
    };

    let evento;
    try {
      // Intentar actualizacion completa (con recurrencia)
      evento = await prisma.evento.update({
        where: { id },
        data: {
          ...updateData,
          esRecurrente:     es_recurrente !== undefined ? !!es_recurrente : existente.esRecurrente,
          patronRecurrencia: es_recurrente && patron_recurrencia
            ? JSON.stringify(patron_recurrencia)
            : (es_recurrente === false ? null : existente.patronRecurrencia),
          fechaFinRecurr:   fecha_fin_recurrencia !== undefined
            ? (fecha_fin_recurrencia ? new Date(fecha_fin_recurrencia) : null)
            : existente.fechaFinRecurr,
        }
      });
    } catch (err) {
      console.warn('[agenda.editar] Falló actualización completa, reintentando básica...', err.message);
      // Fallback: actualización básica sin campos de recurrencia
      evento = await prisma.evento.update({
        where: { id },
        data: updateData
      });
    }

    await syncEventoBestEffort(evento.id);

    return res.json({ evento });
  } catch (error) {
    console.error('[agenda.editar]', error);
    return res.status(500).json({ error: 'Error al editar el evento' });
  }
};

// Notificar a invitados (Interno)
async function crearNotificacionesInvitados(eventoId, creadorId, invitadosIds, tituloEvento, esGlobal = false, proyectoId = null) {
  try {
    if (!prisma) return;
    const cid = parseInt(creadorId);
    const creador = await prisma.usuario.findUnique({ where: { id: cid }, select: { nombre: true } });
    const nombreCreador = creador?.nombre || 'Un miembro';

    let ids = [];
    if (esGlobal) {
      const u = await prisma.usuario.findMany({ where: { id: { not: cid } }, select: { id: true } });
      ids = u.map(x => x.id);
    } else if (invitadosIds && invitadosIds.length > 0) {
      ids = invitadosIds.map(i => parseInt(i)).filter(i => i !== cid && !isNaN(i));
    }

    if (ids.length === 0) return;

    // Enviar una por una para asegurar el trigger de Supabase Realtime
    await Promise.all(ids.map(uid => 
      prisma.notificacion.create({
        data: {
          usuarioId: uid,
          tipo: 'recordatorio',
          mensaje: `${nombreCreador} te ha invitado a: ${tituloEvento}`,
          leida: false
        }
      })
    ));
    console.log(`[Notif] ${ids.length} alertas enviadas individualmente.`);
  } catch (err) {
    console.error('[Notif] Error:', err.message);
  }
}

// POST /api/agenda
const crear = async (req, res) => {
  const { 
    titulo, descripcion, tipo, fecha_inicio, fecha_fin, todo_el_dia, color, 
    alerta_minutos, es_compartido, es_global, proyecto_id, invitados_ids,
    es_recurrente, patron_recurrencia, fecha_fin_recurrencia,
    modalidad, ubicacion, url_reunion, instrucciones_acceso
  } = req.body;
  const usuarioId = req.usuario.id;

  if (!titulo || !tipo || !fecha_inicio) {
    return res.status(400).json({ error: 'Titulo, tipo y fecha de inicio son obligatorios' });
  }


  // Validar recurrencia: si es recurrente, el patrón es obligatorio
  if (es_recurrente && !patron_recurrencia) {
    return res.status(400).json({ error: 'Patron de recurrencia requerido' });
  }

  try {
    const fechaInicioDate = new Date(fecha_inicio);
    const fechaFinDate = fecha_fin ? new Date(fecha_fin) : null;
    if (
      fechaFinDate &&
      !Number.isNaN(fechaInicioDate.getTime()) &&
      !Number.isNaN(fechaFinDate.getTime()) &&
      fechaFinDate <= fechaInicioDate
    ) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
    }

    let isTodoElDia = todo_el_dia === true;
    if (tipo === 'dia_completo') isTodoElDia = true;

    // Construir invitados
    const listadoInvitados = [];
    listadoInvitados.push({ usuarioId, estado: 'aceptado' });

    if (es_compartido) {
      const ids = new Set(invitados_ids || []);
      if (proyecto_id) {
        const proyecto = await prisma.proyecto.findUnique({
          where: { id: parseInt(proyecto_id) },
          include: { miembros: { select: { id: true } } }
        });
        if (proyecto) proyecto.miembros.forEach(m => ids.add(m.id));
      }
      ids.forEach(id => {
        if (id !== usuarioId) listadoInvitados.push({ usuarioId: id, estado: 'pendiente' });
      });
    }

    const createData = {
      usuarioId,
      creadoPorId:       usuarioId,
      titulo,
      descripcion,
      tipo,
      modalidad:         modalidad || 'presencial',
      ubicacion:         ubicacion || null,
      urlReunion:        url_reunion || null,
      instruccionesAcceso: instrucciones_acceso || null,
      fechaInicio:       fechaInicioDate,
      fechaFin:          fechaFinDate,
      todoElDia:         isTodoElDia,
      color:             getColorCategoria(tipo),
      alertaMinutos:     alerta_minutos ? parseInt(alerta_minutos) : null,
      esCompartido:      !!es_compartido,
      esGlobal:          !!es_global,
      proyectoId:        proyecto_id ? parseInt(proyecto_id) : null,
      invitados: { create: listadoInvitados }
    };

    let evento;
    try {
      // Intentar creación completa
      evento = await prisma.evento.create({
        data: {
          ...createData,
          esRecurrente:      !!es_recurrente,
          patronRecurrencia: es_recurrente ? JSON.stringify(patron_recurrencia) : null,
          fechaFinRecurr:    fecha_fin_recurrencia ? new Date(fecha_fin_recurrencia) : null,
        },
        include: { invitados: true }
      });
    } catch (err) {
      console.warn('[agenda.crear] Falló creación completa, reintentando básica...', err.message);
      // Fallback: creación básica
      evento = await prisma.evento.create({
        data: createData,
        include: { invitados: true }
      });
    }

    // Crear notificaciones de forma síncrona para asegurar el envío
    if (es_global || listadoInvitados.length > 1) {
      const idsFinales = listadoInvitados.map(i => i.usuarioId);
      await crearNotificacionesInvitados(evento.id, usuarioId, idsFinales, titulo, !!es_global, proyectoId || null);
    }

    await syncEventoBestEffort(evento.id);

    return res.status(201).json({ evento });
  } catch (error) {
    console.error('[agenda.crear]', error);
    return res.status(500).json({ error: 'Error al crear el evento' });
  }
};


// €€ PATCH /api/agenda/:id/responder €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const responderInvitacion = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'aceptado', 'rechazado'
  const usuarioId = req.usuario.id;

  if (!['aceptado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado de respuesta inválido' });
  }

  try {
    const invitacion = await prisma.eventoInvitado.findFirst({
      where: { eventoId: id, usuarioId }
    });

    if (!invitacion) {
      return res.status(404).json({ error: 'No tienes una invitación para este evento' });
    }

    await prisma.eventoInvitado.update({
      where: { id: invitacion.id },
      data: { estado, visto: true }
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[agenda.responder]', error);
    return res.status(500).json({ error: 'Error al responder invitación' });
  }
};

// €€ GET /api/agenda/invitaciones/pendientes €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const invitacionesPendientes = async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const pendientes = await prisma.eventoInvitado.findMany({
      where: { usuarioId, estado: 'pendiente' },
      include: {
        evento: {
          include: {
            creador: { select: { nombre: true } }
          }
        }
      }
    });
    return res.json({ pendientes });
  } catch (error) {
    console.error('[agenda.pendientes]', error);
    return res.status(500).json({ error: 'Error al obtener invitaciones' });
  }
};

// €€ DELETE /api/agenda/:id €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const eliminar = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const evento = await prisma.evento.findUnique({ where: { id } });
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

    if (evento.creadoPorId === usuarioId || evento.usuarioId === usuarioId) {
      // Es el creador -> Eliminar todo
      await deleteEventoGoogleBestEffort(evento);
      await prisma.evento.delete({ where: { id } });
      return res.json({ ok: true, mensaje: 'Evento eliminado para todos' });
    } else {
      // Es invitado -> Solo salir del evento
      const invitacion = await prisma.eventoInvitado.findFirst({
        where: { eventoId: id, usuarioId }
      });
      if (invitacion) {
        await prisma.eventoInvitado.delete({ where: { id: invitacion.id } });
        return res.json({ ok: true, mensaje: 'Has salido del evento' });
      }
      return res.status(403).json({ error: 'No tienes permiso para eliminar este evento' });
    }
  } catch (error) {
    console.error('[agenda.eliminar]', error);
    return res.status(500).json({ error: 'Error al eliminar el evento' });
  }
};

// €€ GET /api/agenda/disponibilidad €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const consultarDisponibilidad = async (req, res) => {
  const { usuarios_ids, inicio, fin, excluir_id, excluir_proyecto_id } = req.query;
  if (!usuarios_ids || !inicio) return res.status(400).json({ error: 'Faltan parámetros' });

  try {
    const ids = usuarios_ids.split(',').map(id => parseInt(id));
    const start = new Date(inicio);
    const end = fin ? new Date(fin) : new Date(start.getTime() + ONE_DAY_MS);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: 'Rango de fechas invalido' });
    }

    const [eventos, tareas, proyectos] = await Promise.all([
      prisma.evento.findMany({
        where: {
          id: excluir_id ? { not: excluir_id } : undefined,
          proyectoId: null,
          OR: [
            { usuarioId: { in: ids } },
            { invitados: { some: { usuarioId: { in: ids }, estado: 'aceptado' } } }
          ],
          fechaInicio: { lt: end },
          fechaFin: { gt: start }
        },
        select: {
          id: true,
          titulo: true,
          fechaInicio: true,
          fechaFin: true,
          usuarioId: true
        }
      }),
      prisma.tarea.findMany({
        where: {
          proyectoId: excluir_proyecto_id ? { not: parseInt(excluir_proyecto_id) } : undefined,
          asignadoId: { in: ids },
          estado: { in: ['PENDIENTE', 'EN_PROGRESO'] },
          // Cruce de rangos: periodo consultado contra periodo real de cada tarea.
          fechaInicio: { lt: end },
          OR: [
            { venceEn: { gt: start } },
            { venceEn: null, fechaInicio: { gte: start } }
          ]
        },
        select: {
          id: true,
          titulo: true,
          fechaInicio: true,
          venceEn: true,
          asignadoId: true,
          proyectoId: true,
          proyecto: { select: { nombre: true } }
        }
      }),
      prisma.proyecto.findMany({
        where: {
          id: excluir_proyecto_id ? { not: parseInt(excluir_proyecto_id) } : undefined,
          estado: { not: 'CERRADO' },
          miembros: { some: { id: { in: ids } } },
          fechaInicio: { lt: end },
          OR: [
            { fechaFin: null },
            { fechaFin: { gt: start } }
          ]
        },
        select: {
          id: true,
          nombre: true,
          fechaInicio: true,
          fechaFin: true,
          miembros: {
            where: { id: { in: ids } },
            select: { id: true }
          }
        }
      })
    ]);

    const conflictos = [
      ...eventos.map(evento => ({ ...evento, tipo: 'evento' })),
      ...tareas.map(tarea => ({
        id: `tarea-${tarea.id}`,
        titulo: `Tarea: ${tarea.titulo}`,
        fechaInicio: tarea.fechaInicio,
        fechaFin: getFinTareaParaDisponibilidad(tarea),
        usuarioId: tarea.asignadoId,
        proyectoId: tarea.proyectoId,
        proyecto: tarea.proyecto,
        tipo: 'tarea'
      })),
      ...proyectos.flatMap(proyecto => proyecto.miembros.map(miembro => ({
        id: `proyecto-${proyecto.id}-${miembro.id}`,
        titulo: `Proyecto: ${proyecto.nombre}`,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
        usuarioId: miembro.id,
        proyectoId: proyecto.id,
        tipo: 'proyecto'
      })))
    ];

    return res.json({ conflictos });
  } catch (error) {
    console.error('[agenda.disponibilidad]', error);
    return res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
};

// €€ CALENDARIO LABORAL €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€

const getConfigLaboral = async (req, res) => {
  const usuarioId = req.usuario.id;
  try {
    let config = await prisma.configuracionLaboral.findUnique({ where: { usuarioId } });
    if (!config) {
      // Valores por defecto
      config = {
        diasLaborales: [1, 2, 3, 4, 5],
        horaEntrada: '09:00',
        horaSalida: '18:00',
        horaComidaInicio: '14:00',
        horaComidaFin: '15:00'
      };
    }
    return res.json({ config });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener configuracion' });
  }
};

const updateConfigLaboral = async (req, res) => {
  const usuarioId = req.usuario.id;
  const { 
    dias_laborales = [1,2,3,4,5], 
    hora_entrada = '09:00', 
    hora_salida = '18:00', 
    hora_comida_inicio = '14:00', 
    hora_comida_fin = '15:00' 
  } = req.body;

  try {
    const config = await prisma.configuracionLaboral.upsert({
      where: { usuarioId },
      update: {
        diasLaborales: dias_laborales,
        horaEntrada: hora_entrada,
        horaSalida: hora_salida,
        horaComidaInicio: hora_comida_inicio,
        horaComidaFin: hora_comida_fin
      },
      create: {
        usuarioId,
        diasLaborales: dias_laborales,
        horaEntrada: hora_entrada,
        horaSalida: hora_salida,
        horaComidaInicio: hora_comida_inicio,
        horaComidaFin: hora_comida_fin
      }
    });
    return res.json({ config });
  } catch (error) {
    console.error('[agenda.updateConfig]', error);
    return res.status(500).json({ error: 'Error al actualizar configuracion' });
  }
};

// €€ DÍAS ESPECIALES €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€

const listarDiasEspeciales = async (req, res) => {
  const usuarioId = req.usuario.id;
  const { mes, anio } = req.query;

  try {
    const where = { usuarioId };
    if (mes && anio) {
      const start = new Date(parseInt(anio), parseInt(mes) - 1, 1);
      const end = new Date(parseInt(anio), parseInt(mes), 0);
      where.fecha = { gte: start, lte: end };
    }

    const dias = await prisma.diaEspecial.findMany({ where });

    // Feriados Globales de México (Dinámicos)
    if (anio) {
      const currentAnio = parseInt(anio);
      const feriadosGlobales = [
        { id: 'f1', fecha: new Date(currentAnio, 0, 1), tipo: 'festivo', descripcion: 'Año Nuevo' },
        { id: 'f2', fecha: new Date(currentAnio, 1, 2), tipo: 'festivo', descripcion: 'Día de la Constitución' },
        { id: 'f3', fecha: new Date(currentAnio, 2, 16), tipo: 'festivo', descripcion: 'Natalicio de Benito Juárez' },
        { id: 'f4', fecha: new Date(currentAnio, 4, 1), tipo: 'festivo', descripcion: 'Día del Trabajo' },
        { id: 'f5', fecha: new Date(currentAnio, 8, 16), tipo: 'festivo', descripcion: 'Día de la Independencia' },
        { id: 'f6', fecha: new Date(currentAnio, 8, 20), tipo: 'festivo', descripcion: 'Fundación de Monterrey' },
        { id: 'f7', fecha: new Date(currentAnio, 10, 16), tipo: 'festivo', descripcion: 'Aniversario de la Revolución' },
        { id: 'f8', fecha: new Date(currentAnio, 11, 25), tipo: 'festivo', descripcion: 'Navidad' },
      ];

      // Filtrar por mes si se solicita
      const feriadosFiltrados = mes 
        ? feriadosGlobales.filter(f => f.fecha.getMonth() + 1 === parseInt(mes))
        : feriadosGlobales;

      // Combinar (evitar duplicados si el usuario ya los agregó manualmente)
      const fechasUsuario = new Set(dias.map(d => d.fecha.toISOString().split('T')[0]));
      feriadosFiltrados.forEach(f => {
        const fStr = f.fecha.toISOString().split('T')[0];
        if (!fechasUsuario.has(fStr)) {
          dias.push(f);
        }
      });
    }

    return res.json({ dias });
  } catch (error) {
    console.error('[agenda.listarDias]', error);
    return res.status(500).json({ error: 'Error al listar días especiales' });
  }
};

const crearDiaEspecial = async (req, res) => {
  const usuarioId = req.usuario.id;
  const { fecha, fecha_inicio, fecha_fin, tipo, descripcion } = req.body;

  try {
    const inicioBase = fecha_inicio || fecha;
    const finBase = fecha_fin || fecha_inicio || fecha;

    if (!inicioBase || !finBase || !tipo) {
      return res.status(400).json({ error: 'fecha, tipo y rango son requeridos' });
    }

    const inicio = new Date(inicioBase);
    const fin = new Date(finBase);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      return res.status(400).json({ error: 'Rango de fechas invalido' });
    }

    if (fin < inicio) {
      return res.status(400).json({ error: 'La fecha fin debe ser posterior o igual a la fecha inicio' });
    }

    const fechas = [];
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 12, 0, 0, 0);
    const ultimo = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 12, 0, 0, 0);

    while (cursor <= ultimo) {
      fechas.push({
        usuarioId,
        fecha: new Date(cursor),
        tipo,
        descripcion: descripcion || null
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    await prisma.diaEspecial.createMany({
      data: fechas,
      skipDuplicates: true
    });

    return res.status(201).json({ creados: fechas.length });
  } catch (error) {
    console.error('[agenda.crearDia]', error);
    return res.status(500).json({ error: 'Error al crear día especial' });
  }
};

const eliminarDiaEspecial = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const dia = await prisma.diaEspecial.findUnique({ where: { id } });
    if (!dia || dia.usuarioId !== usuarioId) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    await prisma.diaEspecial.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar' });
  }
};

const getGoogleCalendarStatus = async (req, res) => {
  try {
    const status = await getConnectionStatus(req.usuario.id);
    return res.json(status);
  } catch (error) {
    console.error('[agenda.google.status]', error);
    return res.status(500).json({ error: 'Error al consultar Google Calendar' });
  }
};

const connectGoogleCalendarController = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Codigo de autorizacion requerido' });
  }

  try {
    const connection = await connectGoogleCalendar({ usuarioId: req.usuario.id, code });
    return res.json(connection);
  } catch (error) {
    console.error('[agenda.google.connect]', error);
    return res.status(500).json({ error: error.message || 'No se pudo conectar Google Calendar' });
  }
};

const disconnectGoogleCalendarController = async (req, res) => {
  try {
    await disconnectGoogleCalendar(req.usuario.id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[agenda.google.disconnect]', error);
    return res.status(500).json({ error: 'No se pudo desconectar Google Calendar' });
  }
};

const recordatoriosProximos = async (req, res) => {
  const usuarioId = req.usuario.id;
  const ahora = new Date();
  const enUnaHora = new Date(ahora.getTime() + 60 * 60 * 1000);

  try {
    const recordatorios = await prisma.evento.findMany({
      where: {
        OR: [
          { usuarioId, tipo: 'recordatorio' },
          { invitados: { some: { usuarioId } }, tipo: 'recordatorio' }
        ],
        fechaInicio: { gte: ahora, lte: enUnaHora },
      },
      orderBy: { fechaInicio: 'asc' },
    });

    return res.json({ recordatorios });
  } catch (error) {
    return res.status(500).json({ error: 'Error al consultar recordatorios' });
  }
};


module.exports = {
  listar,
  crear,
  editar,
  responderInvitacion,
  invitacionesPendientes,
  eliminar,
  consultarDisponibilidad,
  getConfigLaboral,
  updateConfigLaboral,
  listarDiasEspeciales,
  crearDiaEspecial,
  eliminarDiaEspecial,
  getGoogleCalendarStatus,
  connectGoogleCalendarController,
  disconnectGoogleCalendarController,
  recordatoriosProximos,
};
