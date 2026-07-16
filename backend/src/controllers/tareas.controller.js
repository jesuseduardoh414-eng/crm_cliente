// Controlador de Tareas
// GET    /api/proyectos/:id/tareas  → listar tareas de un proyecto
// POST   /api/proyectos/:id/tareas  → crear tarea
// PUT    /api/tareas/:id            → editar tarea
// DELETE /api/tareas/:id            → eliminar tarea
// PATCH  /api/tareas/:id/estado     → actualizar solo el estado

const prisma = require('../lib/prisma');
const { registrarActividad } = require('../utils/logger');
const { sortTareas } = require('../utils/sort.utils');
const { esAdmin, puedeAdministrarProyecto } = require('../utils/permissions.utils');

const OFFSET_MEXICO_MS = 6 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Selector común para incluir datos del asignado sin exponer password
const INCLUDE_ASIGNADO = {
  asignado: {
    select: { id: true, nombre: true, area: true },
  },
  asignados: {
    select: { id: true, nombre: true, area: true },
  },
  creador: {
    select: { id: true, nombre: true, area: true },
  },
  // La maquina viaja con la tarea para que el tablero pueda mostrarla sin una
  // segunda peticion.
  maquina: {
    select: { id: true, nombre: true, tipo: true, disponible: true },
  },
};

// El id de maquina llega del formulario como texto, '' o null.
// Devuelve: undefined = no tocar, null = desvincular, numero = vincular.
const normalizarMaquinaId = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const n = parseInt(valor, 10);
  return Number.isInteger(n) ? n : NaN; // NaN = invalido, lo valida quien llama
};

const visibilidadTareasPara = (usuarioId) => ({
  OR: [
    { asignadoId: null },
    { asignadoId: usuarioId },
    { asignados: { some: { id: usuarioId } } },
    { creadorId: usuarioId },
  ],
});

const puedeAccederTarea = (tarea, usuarioId) => (
  !tarea.asignadoId
  || tarea.asignadoId === usuarioId
  || tarea.creadorId === usuarioId
  || tarea.asignados?.some((asignado) => asignado.id === usuarioId)
);

const parseArrayValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [value];
};

const normalizarAsignadoIds = (asignadoIds, asignadoIdFallback = undefined) => {
  if (asignadoIds === undefined) {
    if (asignadoIdFallback === undefined) return undefined;
    if (!asignadoIdFallback) return [];
    const id = parseInt(asignadoIdFallback, 10);
    return Number.isNaN(id) ? [] : [id];
  }

  return [...new Set(
    parseArrayValue(asignadoIds)
      .map((value) => parseInt(value, 10))
      .filter((value) => !Number.isNaN(value))
  )];
};

const normalizarNumeroActividad = (numeroActividad) => {
  if (numeroActividad === undefined) return undefined;
  if (numeroActividad === null || numeroActividad === '') return null;
  const numero = parseInt(numeroActividad, 10);
  return Number.isNaN(numero) || numero <= 0 ? null : numero;
};

const asignadosPertenecenAProyecto = (proyecto, asignadoIds = []) => (
  asignadoIds.every((asignadoId) => proyecto.miembros.some((m) => m.id === asignadoId))
);

// Helper para crear notificaciones
const crearNotificacion = async (
  usuarioId,
  mensaje,
  tipo,
  {
    tareaId = null,
  } = {}
) => {
  if (!usuarioId) return;
  try {
    await prisma.notificacion.create({
      data: {
        usuarioId,
        mensaje,
        tipo,
        tareaId,
      }
    });
  } catch (error) {
    console.error('[crearNotificacion]', error);
  }
};

const crearNotificacionesAsignacion = async ({ asignadoIds = [], actorId, mensaje, tipo, tareaId }) => {
  await Promise.all(
    asignadoIds
      .filter((usuarioId) => usuarioId && usuarioId !== actorId)
      .map((usuarioId) => crearNotificacion(usuarioId, mensaje, tipo, { tareaId }))
  );
};

// €€ GET /api/proyectos/:id/tareas €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
// ADMIN → ve todas las tareas del proyecto
// MIEMBRO → ve todas las tareas de los proyectos donde es miembro
const getHoyMexico = () => {
  const ahoraMexico = new Date(Date.now() - OFFSET_MEXICO_MS);
  const year = ahoraMexico.getUTCFullYear();
  const month = ahoraMexico.getUTCMonth();
  const day = ahoraMexico.getUTCDate();

  return {
    inicio: new Date(Date.UTC(year, month, day, 6, 0, 0, 0)),
    mediodia: new Date(Date.UTC(year, month, day, 18, 0, 0, 0)),
    indice: Math.floor(Date.UTC(year, month, day) / ONE_DAY_MS),
  };
};

const getPartesFechaMexico = (value = new Date()) => {
  const fechaMexico = new Date(new Date(value).getTime() - OFFSET_MEXICO_MS);
  return {
    year: fechaMexico.getUTCFullYear(),
    month: fechaMexico.getUTCMonth(),
    day: fechaMexico.getUTCDate(),
  };
};

const crearFechaMexico = ({ year, month, day }, hour = 12) =>
  new Date(Date.UTC(year, month, day, hour + 6, 0, 0, 0));

const getIndiceDiaMexico = (value) => {
  const { year, month, day } = getPartesFechaMexico(value);
  return Math.floor(Date.UTC(year, month, day) / ONE_DAY_MS);
};

const moverFechaAlDiaActual = (value, dias) => {
  if (!value || dias <= 0) return value;
  const siguiente = new Date(value);
  siguiente.setUTCDate(siguiente.getUTCDate() + dias);
  return crearFechaMexico(getPartesFechaMexico(siguiente), 12);
};

const normalizarVenceEnPorEstado = async (tarea) => {
  if (!tarea?.venceEn) return tarea;

  const { indice } = getHoyMexico();
  const cambios = {};

  if (tarea.estado === 'HECHO') {
    const fechaCompletado = tarea.completadoEn || new Date();
    const venceNormalizado = crearFechaMexico(getPartesFechaMexico(fechaCompletado), 12);
    if (new Date(tarea.venceEn).getTime() !== venceNormalizado.getTime()) {
      cambios.venceEn = venceNormalizado;
    }
  } else if (['PENDIENTE', 'EN_PROGRESO'].includes(tarea.estado)) {
    const diasDeDesfase = indice - getIndiceDiaMexico(tarea.venceEn);
    if (diasDeDesfase > 0) {
      cambios.venceEn = moverFechaAlDiaActual(tarea.venceEn, diasDeDesfase);
      if (tarea.fechaInicio) {
        cambios.fechaInicio = moverFechaAlDiaActual(tarea.fechaInicio, diasDeDesfase);
      }
    }
  }

  if (Object.keys(cambios).length === 0) return tarea;

  await prisma.tarea.update({
    where: { id: tarea.id },
    data: cambios,
  });

  return { ...tarea, ...cambios };
};

const listar = async (req, res) => {
  const proyectoId = parseInt(req.params.id);
  if (isNaN(proyectoId)) return res.status(400).json({ error: 'ID de proyecto inválido' });

  try {
    // 0. Reprogramación automática (Rollover) de tareas vencidas del usuario
    // Verificar que el proyecto existe
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { 
        creador: { select: { id: true, nombre: true, area: true } },
        miembros: { select: { id: true, nombre: true, email: true, area: true, rol: true } }
      },
    });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // Verificar permisos: ADMIN puede todo; MIEMBRO puede entrar si participa en el proyecto
    const usuarioEsAdmin = esAdmin(req.usuario);
    if (usuarioEsAdmin && !puedeAdministrarProyecto(req.usuario, proyecto)) {
      return res.status(403).json({ error: 'No tienes permiso para ver las tareas de este proyecto' });
    }
    if (!usuarioEsAdmin) {
      const esMiembro = proyecto.miembros.some(m => m.id === req.usuario.id);
      const participaPorTarea = await prisma.tarea.findFirst({
        where: {
          proyectoId,
          OR: [
            { asignadoId: req.usuario.id },
            { asignados: { some: { id: req.usuario.id } } },
            { creadorId: req.usuario.id },
          ],
        },
        select: { id: true },
      });
      const esCreadorProyecto = proyecto.creador?.id === req.usuario.id;
      if (!esMiembro && !participaPorTarea && !esCreadorProyecto) {
        return res.status(403).json({ error: 'No tienes permiso para ver las tareas de este proyecto' });
      }
    }

    const tareas = await prisma.tarea.findMany({
      where: {
        proyectoId,
        ...(usuarioEsAdmin ? {} : visibilidadTareasPara(req.usuario.id)),
      },
      orderBy: { creadoEn: 'asc' },
      include: INCLUDE_ASIGNADO,
    });

    // Ajustar fechas para evitar desfases de zona horaria (poner a mediodía)
    const tareasNormalizadas = await Promise.all(tareas.map(normalizarVenceEnPorEstado));
    const tareasAjustadas = tareasNormalizadas.map(t => {
      if (t.venceEn) {
        const d = new Date(t.venceEn);
        if (d.getUTCHours() === 0) d.setUTCHours(12);
        t.venceEn = d;
      }
      if (t.fechaInicio) {
        const d = new Date(t.fechaInicio);
        if (d.getUTCHours() === 0) d.setUTCHours(12);
        t.fechaInicio = d;
      }
      if (t.completadoEn) {
        t.completadoEn = new Date(t.completadoEn);
      }
      return t;
    });

    const todasLasTareas = await prisma.tarea.findMany({
      where: { proyectoId },
      select: { estado: true, asignadoId: true, asignados: { select: { id: true } } },
    });
    
    const tareasMiembro = todasLasTareas.filter((t) =>
      t.asignadoId === req.usuario.id
      || t.asignados.some((asignado) => asignado.id === req.usuario.id)
    );
    
    // Stats Generales (Todo el proyecto)
    const totalGeneral = todasLasTareas.length;
    const hechasGeneral = todasLasTareas.filter(t => t.estado === 'HECHO').length;
    const pendientesGeneral = todasLasTareas.filter(t => t.estado === 'PENDIENTE').length;
    const enProgresoGeneral = todasLasTareas.filter(t => t.estado === 'EN_PROGRESO').length;

    // Stats Miembro
    const totalMiembro = tareasMiembro.length;
    const hechasMiembro = tareasMiembro.filter(t => t.estado === 'HECHO').length;
    const pendientesMiembro = tareasMiembro.filter(t => t.estado === 'PENDIENTE').length;
    const enProgresoMiembro = tareasMiembro.filter(t => t.estado === 'EN_PROGRESO').length;

    return res.json({
      proyecto,
      tareas: sortTareas(tareasAjustadas),
      progreso: {
        general: {
          total: totalGeneral,
          hechas: hechasGeneral,
          pendientes: pendientesGeneral,
          enProgreso: enProgresoGeneral,
          porcentaje: totalGeneral > 0 ? Math.round((hechasGeneral / totalGeneral) * 100) : 0,
        },
        miembro: {
          total: totalMiembro,
          hechas: hechasMiembro,
          pendientes: pendientesMiembro,
          enProgreso: enProgresoMiembro,
          porcentaje: totalMiembro > 0 ? Math.round((hechasMiembro / totalMiembro) * 100) : 0,
        },
      },
      filtradoPorUsuario: !usuarioEsAdmin, 
    });
  } catch (error) {
    console.error('[tareas.listar]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ POST /api/proyectos/:id/tareas €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const crear = async (req, res) => {
  const proyectoId = parseInt(req.params.id);
  if (isNaN(proyectoId)) return res.status(400).json({ error: 'ID de proyecto inválido' });

  const { titulo, descripcion, numeroActividad, asignadoId, asignadoIds, prioridad, estado, fechaInicio, venceEn, dependeDeId, primerComentario, maquinaId } = req.body;
  const archivos = req.files;

  if (!titulo || titulo.trim() === '') {
    return res.status(400).json({ error: 'El título de la tarea es requerido' });
  }

  const maquinaIdNormalizado = normalizarMaquinaId(maquinaId);
  if (Number.isNaN(maquinaIdNormalizado)) {
    return res.status(400).json({ error: 'La máquina indicada no es válida' });
  }

  try {
    // Verificar que el proyecto existe
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { miembros: { select: { id: true } } }
    });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const asignadoIdsNormalizados = normalizarAsignadoIds(asignadoIds, asignadoId);
    const asignadoPrincipalId = asignadoIdsNormalizados?.[0] ?? null;

    // Si es MIEMBRO, verificar que pertenece a la lista de miembros del proyecto
    if (esAdmin(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para crear tareas en este proyecto' });
      }
    } else {
      const miembro = await prisma.proyecto.findFirst({
        where: {
          id: proyectoId,
          miembros: { some: { id: req.usuario.id } }
        }
      });
      if (!miembro) {
        return res.status(403).json({ error: 'No tienes permiso para crear tareas en este proyecto' });
      }
    }

    if (!asignadosPertenecenAProyecto(proyecto, asignadoIdsNormalizados || [])) {
      return res.status(400).json({ error: 'Solo puedes asignar tareas a miembros de este proyecto' });
    }

    // La maquina tiene que existir; si no, la tarea apuntaria a la nada.
    if (maquinaIdNormalizado) {
      const maquina = await prisma.maquina.findUnique({ where: { id: maquinaIdNormalizado } });
      if (!maquina) return res.status(404).json({ error: 'La máquina indicada no existe' });
    }

    const numeroActividadNormalizado = normalizarNumeroActividad(numeroActividad);

    // Crear la tarea
    let dInicio = fechaInicio ? new Date(fechaInicio) : new Date();
    if (dInicio.getUTCHours() === 0) dInicio.setUTCHours(12);

    let dVence = venceEn ? new Date(venceEn) : null;
    if (dVence && dVence.getUTCHours() === 0) dVence.setUTCHours(12);

    const estadoFinal = estado || 'PENDIENTE';

    const tarea = await prisma.tarea.create({
      data: {
        titulo:      titulo.trim(),
        descripcion: descripcion?.trim() || null,
        numeroActividad: numeroActividadNormalizado,
        prioridad:   prioridad  || 'MEDIA',
        estado:      estadoFinal,
        completadoEn: estadoFinal === 'HECHO' ? new Date() : null,
        fechaInicio: dInicio,
        venceEn:     dVence,
        proyectoId,
        asignadoId:  asignadoPrincipalId,
        asignados:   {
          connect: (asignadoIdsNormalizados || []).map((idAsignado) => ({ id: idAsignado })),
        },
        creadorId:   req.usuario.id,
        dependeDeId: dependeDeId ? parseInt(dependeDeId) : null,
        maquinaId:   maquinaIdNormalizado ?? null,
      },
      include: INCLUDE_ASIGNADO,
    });

    // 1. Crear comentario inicial si existe
    if (primerComentario && primerComentario.trim() !== '') {
      await prisma.comentario.create({
        data: {
          contenido: primerComentario.trim(),
          tareaId: tarea.id,
          autorId: req.usuario.id
        }
      });
    }

    // 2. Guardar archivos si existen
    if (archivos && archivos.length > 0) {
      const adjuntosData = archivos.map(file => ({
        nombre: file.originalname,
        url: file.filename,
        tipo: file.mimetype,
        tamano: file.size,
        tareaId: tarea.id,
        usuarioId: req.usuario.id
      }));

      await prisma.adjunto.createMany({
        data: adjuntosData
      });
    }

    // Notificar al asignado si no es quien la crea
    await crearNotificacionesAsignacion({
      asignadoIds: asignadoIdsNormalizados || [],
      actorId: req.usuario.id,
      mensaje: `Te han asignado una nueva tarea: "${tarea.titulo}"`,
      tipo: 'ASIGNACION',
      tareaId: tarea.id,
    });

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      proyectoId,
      'CREAR_TAREA',
      `${req.usuario.nombre} creó la tarea "${tarea.titulo}"${archivos?.length ? ` con ${archivos.length} archivos` : ''}`,
      tarea.id
    );

    return res.status(201).json({ mensaje: 'Tarea creada exitosamente', tarea });
  } catch (error) {
    console.error('[tareas.crear]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ PUT /api/tareas/:id €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const editar = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { titulo, descripcion, numeroActividad, asignadoId, asignadoIds, prioridad, estado, fechaInicio, venceEn, dependeDeId, maquinaId } = req.body;

  const maquinaIdNormalizado = normalizarMaquinaId(maquinaId);
  if (Number.isNaN(maquinaIdNormalizado)) {
    return res.status(400).json({ error: 'La máquina indicada no es válida' });
  }

  try {
    const existente = await prisma.tarea.findUnique({
      where: { id },
      include: {
        proyecto: { include: { miembros: { select: { id: true } } } },
        asignados: { select: { id: true } },
      }
    });
    if (!existente) return res.status(404).json({ error: 'Tarea no encontrada' });
    const asignadoIdsNormalizados = normalizarAsignadoIds(asignadoIds, asignadoId);
    const asignadoPrincipalId = asignadoIdsNormalizados?.[0] ?? null;

    // Verificar permisos: ADMIN o miembro con visibilidad sobre esta tarea
    if (esAdmin(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, existente.proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para editar esta tarea' });
      }
    } else {
      const esMiembro = existente.proyecto.miembros.some(m => m.id === req.usuario.id);
      if (!esMiembro || !puedeAccederTarea(existente, req.usuario.id)) {
        return res.status(403).json({ error: 'No tienes permiso para editar esta tarea' });
      }
    }

    if (asignadoIdsNormalizados !== undefined && !asignadosPertenecenAProyecto(existente.proyecto, asignadoIdsNormalizados)) {
      return res.status(400).json({ error: 'Solo puedes asignar tareas a miembros de este proyecto' });
    }

    if (maquinaIdNormalizado) {
      const maquina = await prisma.maquina.findUnique({ where: { id: maquinaIdNormalizado } });
      if (!maquina) return res.status(404).json({ error: 'La máquina indicada no existe' });
    }

    const numeroActividadNormalizado = normalizarNumeroActividad(numeroActividad);

    let dInicio = fechaInicio !== undefined ? (fechaInicio ? new Date(fechaInicio) : new Date()) : undefined;
    if (dInicio && dInicio.getUTCHours() === 0) dInicio.setUTCHours(12);

    let dVence = venceEn !== undefined ? (venceEn ? new Date(venceEn) : null) : undefined;
    if (dVence && dVence.getUTCHours() === 0) dVence.setUTCHours(12);

    const estadoFinal = estado !== undefined ? estado : existente.estado;

    let tarea = await prisma.tarea.update({
      where: { id },
      data: {
        ...(titulo       !== undefined && { titulo: titulo.trim() }),
        ...(descripcion  !== undefined && { descripcion: descripcion?.trim() || null }),
        ...(numeroActividad !== undefined && { numeroActividad: numeroActividadNormalizado }),
        ...(prioridad    !== undefined && { prioridad }),
        ...(estado       !== undefined && { estado }),
        ...(estado !== undefined && {
          completadoEn: estadoFinal === 'HECHO'
            ? (existente.estado === 'HECHO' ? existente.completadoEn || new Date() : new Date())
            : null
        }),
        ...(maquinaIdNormalizado !== undefined && { maquinaId: maquinaIdNormalizado }),
        ...(asignadoIdsNormalizados !== undefined && { asignadoId: asignadoPrincipalId }),
        ...(asignadoIdsNormalizados !== undefined && {
          asignados: {
            set: asignadoIdsNormalizados.map((idAsignado) => ({ id: idAsignado })),
          },
        }),
        ...(dInicio      !== undefined && { fechaInicio: dInicio }),
        ...(dVence       !== undefined && { venceEn: dVence }),
        ...(dependeDeId  !== undefined && { dependeDeId: dependeDeId ? parseInt(dependeDeId) : null }),
      },
      include: INCLUDE_ASIGNADO,
    });

    tarea = await normalizarVenceEnPorEstado(tarea);

    // Notificar cambios al asignado si no es quien edita
    if (tarea.asignadoId && tarea.asignadoId !== req.usuario.id) {
      let msg = '';
      if (existente.asignadoId !== tarea.asignadoId) {
        msg = `Te han asignado la tarea: "${tarea.titulo}"`;
      } else if (existente.estado !== tarea.estado) {
        msg = `El estado de tu tarea "${tarea.titulo}" cambió a ${tarea.estado}`;
      } else {
        msg = `Se actualizó la información de tu tarea: "${tarea.titulo}"`;
      }
      
      await crearNotificacion(tarea.asignadoId, msg, 'URGENTE', {
        tareaId: tarea.id,
      });
    }

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      tarea.proyectoId,
      'EDITAR_TAREA',
      `${req.usuario.nombre} editó la tarea "${tarea.titulo}"`,
      tarea.id
    );

    return res.json({ mensaje: 'Tarea actualizada', tarea });
  } catch (error) {
    console.error('[tareas.editar]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ DELETE /api/tareas/:id €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const eliminar = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

  try {
    const existente = await prisma.tarea.findUnique({ 
      where: { id },
      include: {
        proyecto: { include: { miembros: { select: { id: true } } } },
        asignados: { select: { id: true } },
      }
    });
    if (!existente) return res.status(404).json({ error: 'Tarea no encontrada' });

    // Verificar permisos: ADMIN o miembro con visibilidad sobre esta tarea
    if (esAdmin(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, existente.proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
      }
    } else {
      const esMiembro = existente.proyecto.miembros.some(m => m.id === req.usuario.id);
      if (!esMiembro || !puedeAccederTarea(existente, req.usuario.id)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tarea.updateMany({
        where: { dependeDeId: id },
        data: { dependeDeId: null },
      });

      await tx.comentario.deleteMany({ where: { tareaId: id } });
      await tx.adjunto.deleteMany({ where: { tareaId: id } });
      await tx.logActividad.deleteMany({ where: { tareaId: id } });
      await tx.notificacion.updateMany({
        where: { tareaId: id },
        data: { tareaId: null },
      });

      await tx.tarea.delete({ where: { id } });
    });

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      existente.proyectoId,
      'ELIMINAR_TAREA',
      `${req.usuario.nombre} eliminó la tarea "${existente.titulo}"`
    );
    return res.json({ mensaje: 'Tarea eliminada' });
  } catch (error) {
    console.error('[tareas.eliminar]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ PATCH /api/tareas/:id/estado €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const actualizarEstado = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

  const { estado } = req.body;
  const estadosValidos = ['PENDIENTE', 'EN_PROGRESO', 'HECHO'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}` });
  }

  try {
    const existente = await prisma.tarea.findUnique({ 
      where: { id },
      include: {
        proyecto: { include: { miembros: { select: { id: true } } } },
        asignados: { select: { id: true } },
      }
    });
    if (!existente) return res.status(404).json({ error: 'Tarea no encontrada' });

    // Verificar permisos: ADMIN o miembro con visibilidad sobre esta tarea
    if (esAdmin(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, existente.proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar esta tarea' });
      }
    } else {
      const esMiembro = existente.proyecto.miembros.some(m => m.id === req.usuario.id);
      if (!esMiembro || !puedeAccederTarea(existente, req.usuario.id)) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar esta tarea' });
      }
    }

    let tarea = await prisma.tarea.update({
      where: { id },
      data:  {
        estado,
        completadoEn: estado === 'HECHO' ? new Date() : null,
      },
      include: INCLUDE_ASIGNADO,
    });

    tarea = await normalizarVenceEnPorEstado(tarea);
    // Notificar cambio de estado al asignado
    if (tarea.asignadoId && tarea.asignadoId !== req.usuario.id) {
      await crearNotificacion(
        tarea.asignadoId,
        `El estado de tu tarea "${tarea.titulo}" cambió a ${tarea.estado}`,
        'ESTADO',
        {
          tareaId: tarea.id,
        }
      );
    }

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      tarea.proyectoId,
      'CAMBIO_ESTADO',
      `${req.usuario.nombre} cambió el estado de "${tarea.titulo}" a ${tarea.estado}`,
      tarea.id
    );

    return res.json({ mensaje: 'Estado actualizado', tarea });
  } catch (error) {
    console.error('[tareas.actualizarEstado]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, crear, editar, eliminar, actualizarEstado };
