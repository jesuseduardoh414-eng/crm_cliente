// Controlador de Proyectos
// ADMIN †’ ve todos los proyectos
// MIEMBRO †’ solo los proyectos donde tiene tareas asignadas

const prisma = require('../lib/prisma');
const { registrarActividad } = require('../utils/logger');
const { sortProyectos } = require('../utils/sort.utils');
const { addDays, buildTemplateTasksFromProject } = require('../utils/plantillas.utils');
const { esAdmin, buildScopeProyectoParaAdmin, puedeAdministrarProyecto, puedeGestionarArea } = require('../utils/permissions.utils');

// Campos comunes del include
const INCLUDE_PROYECTO = {
  creador: { select: { id: true, nombre: true, area: true } },
  miembros: { select: { id: true, nombre: true, email: true, area: true, rol: true, fotoPerfilUrl: true } },
  _count:  { select: { tareas: true } },
};

const INCLUDE_PLANTILLA = {
  creador: { select: { id: true, nombre: true, area: true } },
  proyectoBase: { select: { id: true, nombre: true } },
  tareas: {
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      clave: true,
      titulo: true,
      descripcion: true,
      prioridad: true,
      orden: true,
      offsetInicioDias: true,
      offsetVenceDias: true,
      dependeDeClave: true,
    },
  },
  _count: { select: { tareas: true } },
};

const parseJsonArray = (value) => {
  if (!value) return [];
  return typeof value === 'string' ? JSON.parse(value) : value;
};

const normalizarIds = (ids) => [...new Set(ids.map(id => Number(id)).filter(id => !Number.isNaN(id)))];

const areasDeProyecto = (area) => (area || 'VENTAS')
  .split(',')
  .map(a => a.trim())
  .filter(Boolean);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getPlantillasDbError = (error, accion = 'operar con las plantillas') => {
  const message = String(error?.message || '');
  const code = error?.code;

  if (
    code === 'P2021'
    || code === 'P2022'
    || message.includes('plantillas_proyecto')
    || message.includes('plantillas_tarea')
    || message.includes('does not exist')
    || message.includes('Unknown argument')
  ) {
    return `Falta aplicar la migracion de plantillas o regenerar Prisma antes de ${accion}. Ejecuta: npx prisma migrate deploy && npx prisma generate`;
  }

  return null;
};

const getRangoProyecto = (fechaInicio, fechaFin) => {
  const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
  const fin = fechaFin ? new Date(fechaFin) : new Date(inicio.getTime() + ONE_DAY_MS);
  if (fechaFin && /^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
    fin.setDate(fin.getDate() + 1);
  }
  return { inicio, fin };
};

const validarRangoProyecto = ({ inicio, fin }) => {
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return 'Las fechas del proyecto no son validas';
  }
  if (fin <= inicio) {
    return 'La fecha fin del proyecto debe ser posterior a la fecha inicio';
  }
  return null;
};

const validarMiembrosPorArea = async (ids) => {
  if (ids.length === 0) return { usuarios: [], invalidos: [] };
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, area: true, rol: true }
  });
  const idsValidos = new Set(usuarios.map(u => u.id));
  return {
    usuarios,
    invalidos: ids.filter(id => !idsValidos.has(id)),
  };
};

const sincronizarCalendarioProyecto = async ({ proyecto, ids }) => {
  await prisma.evento.deleteMany({ where: { proyectoId: proyecto.id } });

  if (ids.length === 0 || !proyecto.fechaInicio || !proyecto.fechaFin) return;
  const fechaFinEvento = new Date(proyecto.fechaFin);
  if (
    fechaFinEvento.getHours() === 0 &&
    fechaFinEvento.getMinutes() === 0 &&
    fechaFinEvento.getSeconds() === 0
  ) {
    fechaFinEvento.setDate(fechaFinEvento.getDate() + 1);
  }

  await prisma.evento.createMany({
    data: ids.map(usuarioId => ({
      usuarioId,
      titulo: `Proyecto: ${proyecto.nombre}`,
      descripcion: proyecto.descripcion || null,
      tipo: 'dia_completo',
      fechaInicio: proyecto.fechaInicio,
      fechaFin: fechaFinEvento,
      todoElDia: true,
      color: '#2563eb',
      proyectoId: proyecto.id,
      creadoPorId: proyecto.creadorId,
    }))
  });
};

const aplicarPlantillaATareas = async ({ tx, proyecto, plantilla, creadorId }) => {
  if (!plantilla?.tareas?.length) return [];

  const creadas = [];
  const idByClave = new Map();

  for (const tarea of plantilla.tareas) {
    const creada = await tx.tarea.create({
      data: {
        numeroActividad: typeof tarea.numeroActividad === 'number' ? tarea.numeroActividad : (tarea.orden + 1),
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        prioridad: tarea.prioridad || 'MEDIA',
        estado: 'PENDIENTE',
        fechaInicio: addDays(proyecto.fechaInicio, tarea.offsetInicioDias || 0),
        venceEn: tarea.offsetVenceDias !== null && tarea.offsetVenceDias !== undefined
          ? addDays(proyecto.fechaInicio, tarea.offsetVenceDias)
          : null,
        proyectoId: proyecto.id,
        creadorId,
      },
      select: { id: true, titulo: true },
    });

    creadas.push(creada);
    idByClave.set(tarea.clave, creada.id);
  }

  for (const tarea of plantilla.tareas) {
    if (!tarea.dependeDeClave) continue;
    const tareaId = idByClave.get(tarea.clave);
    const dependeDeId = idByClave.get(tarea.dependeDeClave);
    if (!tareaId || !dependeDeId) continue;

    await tx.tarea.update({
      where: { id: tareaId },
      data: { dependeDeId },
    });
  }

  return creadas;
};

// €€ GET /api/proyectos €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
// ADMIN: todos los proyectos
// MIEMBRO: solo proyectos donde es miembro explícito
const listar = async (req, res) => {
  try {
    const usuarioEsAdmin = esAdmin(req.usuario);
    const scopeAdmin = buildScopeProyectoParaAdmin(req.usuario);

    const where = usuarioEsAdmin
      ? scopeAdmin
      : {
          OR: [
            { miembros: { some: { id: req.usuario.id } } },
            { creadorId: req.usuario.id },
            { tareas: { some: { asignadoId: req.usuario.id } } },
            { tareas: { some: { creadorId: req.usuario.id } } },
          ],
        };

    const proyectos = await prisma.proyecto.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        ...INCLUDE_PROYECTO,
        tareas: {
          select: { estado: true, asignadoId: true }
        }
      },
    });

    const proyectosConProgreso = proyectos.map(p => {
      const total = p.tareas.length;
      const hechas = p.tareas.filter(t => t.estado === 'HECHO').length;
      const progreso = total > 0 ? Math.round((hechas / total) * 100) : 0;
      const tareasMiembro = p.tareas.filter(t => t.asignadoId === req.usuario.id);
      const hechasMiembro = tareasMiembro.filter(t => t.estado === 'HECHO').length;
      const progresoMiembro = tareasMiembro.length > 0
        ? Math.round((hechasMiembro / tareasMiembro.length) * 100)
        : 0;
      
      // Eliminamos el array de tareas para no sobrecargar la respuesta JSON
      const { tareas, ...resto } = p;
      return {
        ...resto,
        progreso,
        progresoGeneral: progreso,
        progresoMiembro: usuarioEsAdmin ? null : progresoMiembro,
        tareasMiembro: usuarioEsAdmin ? null : tareasMiembro.length,
      };
    });

    return res.json({ proyectos: sortProyectos(proyectosConProgreso), filtradoPorUsuario: !usuarioEsAdmin });
  } catch (error) {
    console.error('[proyectos.listar]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listarPlantillas = async (req, res) => {
  try {
    const plantillas = await prisma.plantillaProyecto.findMany({
      where: esAdmin(req.usuario) ? buildScopeProyectoParaAdmin(req.usuario) : undefined,
      orderBy: [{ creadoEn: 'desc' }],
      include: INCLUDE_PLANTILLA,
    });

    return res.json({
      plantillas: plantillas.map((plantilla) => ({
        ...plantilla,
        totalTareas: plantilla._count?.tareas ?? plantilla.tareas.length,
      })),
    });
  } catch (error) {
    console.error('[plantillas.listar]', error);
    const detalle = getPlantillasDbError(error, 'listar las plantillas');
    if (detalle) {
      return res.status(500).json({ error: detalle });
    }
    return res.status(500).json({ error: 'Error al listar plantillas' });
  }
};

const guardarComoPlantilla = async (req, res) => {
  const proyectoId = parseInt(req.params.id);
  const { nombre, descripcion } = req.body;
  if (isNaN(proyectoId)) return res.status(400).json({ error: 'ID inválido' });
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre de la plantilla es requerido' });

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        miembros: { select: { id: true } },
        tareas: {
          select: {
            id: true,
            titulo: true,
            descripcion: true,
            prioridad: true,
            fechaInicio: true,
            venceEn: true,
            dependeDeId: true,
            creadoEn: true,
          },
        },
      },
    });

    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const puede = puedeAdministrarProyecto(req.usuario, proyecto)
      || proyecto.creadorId === req.usuario.id
      || proyecto.miembros.some(m => m.id === req.usuario.id);

    if (!puede) {
      return res.status(403).json({ error: 'No tienes permiso para crear una plantilla de este proyecto' });
    }

    const tareasPlantilla = buildTemplateTasksFromProject({ proyecto, tareas: proyecto.tareas });

    const plantilla = await prisma.plantillaProyecto.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || proyecto.descripcion || null,
        area: proyecto.area || 'VENTAS',
        creadorId: req.usuario.id,
        proyectoBaseId: proyecto.id,
        tareas: {
          create: tareasPlantilla,
        },
      },
      include: INCLUDE_PLANTILLA,
    });

    await registrarActividad(
      req.usuario.id,
      proyecto.id,
      'CREAR_PLANTILLA',
      `${req.usuario.nombre} guardó la plantilla "${plantilla.nombre}" desde el proyecto "${proyecto.nombre}"`
    );

    return res.status(201).json({
      mensaje: 'Plantilla guardada correctamente',
      plantilla: {
        ...plantilla,
        totalTareas: plantilla._count?.tareas ?? plantilla.tareas.length,
      },
    });
  } catch (error) {
    console.error('[plantillas.guardarComoPlantilla]', error);
    const detalle = getPlantillasDbError(error, 'guardar la plantilla');
    if (detalle) {
      return res.status(500).json({ error: detalle });
    }
    return res.status(500).json({ error: 'Error al guardar la plantilla' });
  }
};

// €€ GET /api/proyectos/:id/equipo €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
// Devuelve los miembros asignados oficialmente al proyecto
const equipo = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id },
      include: { 
        creador: { select: { id: true, nombre: true, area: true, rol: true, email: true, fotoPerfilUrl: true } },
        miembros: {
          select: {
            id: true, nombre: true, email: true, area: true, rol: true, fotoPerfilUrl: true,
            // Contar sus tareas en este proyecto por estado
            tareasAsignadas: {
              where: { proyectoId: id },
              select: { estado: true },
            },
          }
        }
      },
    });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    if (esAdmin(req.usuario) && !puedeAdministrarProyecto(req.usuario, proyecto)) {
      return res.status(403).json({ error: 'No tienes permiso para ver el equipo de este proyecto' });
    }

    // Enriquecer con conteos de estado
    const miembrosConStats = proyecto.miembros.map(m => ({
      id:        m.id,
      nombre:    m.nombre,
      email:     m.email,
      area:      m.area,
      rol:       m.rol,
      fotoPerfilUrl: m.fotoPerfilUrl ?? null,
      tareas: {
        total:      m.tareasAsignadas.length,
        pendientes: m.tareasAsignadas.filter(t => t.estado === 'PENDIENTE').length,
        enProgreso: m.tareasAsignadas.filter(t => t.estado === 'EN_PROGRESO').length,
        hechas:     m.tareasAsignadas.filter(t => t.estado === 'HECHO').length,
      },
    }));

    return res.json({ proyecto, equipo: miembrosConStats });
  } catch (error) {
    console.error('[proyectos.equipo]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ POST /api/proyectos €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const crear = async (req, res) => {
  const { nombre, descripcion, estado, area, fechaInicio, fechaFin, primerComentario, miembrosIds, plantillaId } = req.body;
  const archivos = req.files;

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  }

  try {
    // Procesar IDs de miembros (pueden venir como string JSON en multipart)
    const ids = normalizarIds(parseJsonArray(miembrosIds));
    const idsProyecto = ids.includes(req.usuario.id) ? ids : [...ids, req.usuario.id];

    const areaProyecto = area || 'VENTAS';
    if (esAdmin(req.usuario) && !areasDeProyecto(areaProyecto).every((areaItem) => puedeGestionarArea(req.usuario, areaItem))) {
      return res.status(403).json({ error: 'Solo puedes crear proyectos en tu propia área' });
    }

    const { invalidos } = await validarMiembrosPorArea(ids);
    if (invalidos.length > 0) {
      return res.status(400).json({ error: 'Solo puedes asignar miembros válidos al proyecto' });
    }

    const { inicio, fin } = getRangoProyecto(fechaInicio, fechaFin);
    const errorFechas = validarRangoProyecto({ inicio, fin });
    if (errorFechas) return res.status(400).json({ error: errorFechas });

    const plantillaIdNum = plantillaId ? parseInt(plantillaId) : null;
    const plantilla = plantillaIdNum
      ? await prisma.plantillaProyecto.findUnique({
          where: { id: plantillaIdNum },
          include: { tareas: { orderBy: { orden: 'asc' } } },
        })
      : null;

    if (plantillaId && (!plantillaIdNum || !plantilla)) {
      return res.status(404).json({ error: 'La plantilla seleccionada no existe' });
    }

    if (plantilla && esAdmin(req.usuario) && !puedeAdministrarProyecto(req.usuario, { area: plantilla.area })) {
      return res.status(403).json({ error: 'No tienes permiso para usar plantillas de otra área' });
    }

    const proyecto = await prisma.$transaction(async (tx) => {
      const creado = await tx.proyecto.create({
        data: {
          nombre:      nombre.trim(),
          descripcion: descripcion?.trim() || null,
          estado:      estado || 'ACTIVO',
          area:        areaProyecto,
          fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
          fechaFin:    fechaFin ? new Date(fechaFin) : null,
          creadorId:   req.usuario.id,
          miembros: {
            connect: idsProyecto.map(id => ({ id: Number(id) }))
          }
        },
        include: INCLUDE_PROYECTO,
      });

      if (plantilla) {
        await aplicarPlantillaATareas({ tx, proyecto: creado, plantilla, creadorId: req.usuario.id });
      }

      return creado;
    });

    await sincronizarCalendarioProyecto({ proyecto, ids });

    // 1. Crear comentario inicial si existe
    if (primerComentario && primerComentario.trim() !== '') {
      await prisma.comentario.create({
        data: {
          contenido: primerComentario.trim(),
          proyectoId: proyecto.id,
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
        proyectoId: proyecto.id,
        usuarioId: req.usuario.id
      }));

      await prisma.adjunto.createMany({
        data: adjuntosData
      });
    }

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      proyecto.id,
      'CREAR_PROYECTO',
      `${req.usuario.nombre} creó el proyecto "${proyecto.nombre}" con ${idsProyecto.length} miembros${plantilla ? ` usando la plantilla "${plantilla.nombre}"` : ''}`
    );

    return res.status(201).json({ mensaje: 'Proyecto creado', proyecto });
  } catch (error) {
    console.error('[proyectos.crear]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ PUT /api/proyectos/:id €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const editar = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, descripcion, estado, area, fechaInicio, fechaFin, miembrosIds } = req.body;
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existente = await prisma.proyecto.findUnique({
      where: { id },
      include: {
        miembros: { select: { id: true } },
      },
    });
    if (!existente) return res.status(404).json({ error: 'Proyecto no encontrado' });

    if (esAdmin(req.usuario) && !puedeAdministrarProyecto(req.usuario, existente)) {
      return res.status(403).json({ error: 'No tienes permiso para editar este proyecto' });
    }

    let dataUpdate = {
      ...(nombre      && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
      ...(estado      && { estado }),
      ...(area        && { area }),
      ...(fechaInicio && { fechaInicio: new Date(fechaInicio) }),
      ...(fechaFin !== undefined && { fechaFin: fechaFin ? new Date(fechaFin) : null }),
    };

    // Actualizar miembros si se envían
    let ids = null;
    if (miembrosIds) {
      ids = normalizarIds(parseJsonArray(miembrosIds));
      const idsProyecto = ids.includes(existente.creadorId) ? ids : [...ids, existente.creadorId];
      const idsExistentes = new Set(existente.miembros.map(m => m.id));
      const idsNuevos = ids.filter(mid => !idsExistentes.has(mid));
      const areaProyecto = area || existente.area;
      if (esAdmin(req.usuario) && !areasDeProyecto(areaProyecto).every((areaItem) => puedeGestionarArea(req.usuario, areaItem))) {
        return res.status(403).json({ error: 'Solo puedes mover el proyecto dentro de tu propia área' });
      }
      const { invalidos } = await validarMiembrosPorArea(ids);
      if (invalidos.length > 0) {
        return res.status(400).json({ error: 'Solo puedes asignar miembros válidos al proyecto' });
      }

      const { inicio, fin } = getRangoProyecto(fechaInicio || existente.fechaInicio, fechaFin !== undefined ? fechaFin : existente.fechaFin);
      const errorFechas = validarRangoProyecto({ inicio, fin });
      if (errorFechas) return res.status(400).json({ error: errorFechas });

      dataUpdate.miembros = {
        set: idsProyecto.map(mid => ({ id: Number(mid) }))
      };
    }

    const proyecto = await prisma.proyecto.update({
      where: { id },
      data: dataUpdate,
      include: INCLUDE_PROYECTO,
    });

    if (ids) {
      await sincronizarCalendarioProyecto({ proyecto, ids });
    }

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      proyecto.id,
      'EDITAR_PROYECTO',
      `${req.usuario.nombre} actualizó el proyecto "${proyecto.nombre}"`
    );

    return res.json({ mensaje: 'Proyecto actualizado', proyecto });
  } catch (error) {
    console.error('[proyectos.editar]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ DELETE /api/proyectos/:id €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const eliminar = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!esAdmin(req.usuario)) {
    return res.status(403).json({ error: 'Solo los administradores pueden eliminar proyectos' });
  }
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const existente = await prisma.proyecto.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ error: 'Proyecto no encontrado' });

    if (!puedeAdministrarProyecto(req.usuario, existente)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este proyecto' });
    }

    await prisma.tarea.deleteMany({ where: { proyectoId: id } });
    await prisma.proyecto.delete({ where: { id } });

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      id,
      'ELIMINAR_PROYECTO',
      `${req.usuario.nombre} eliminó el proyecto "${existente.nombre}"`
    );
    return res.json({ mensaje: 'Proyecto eliminado correctamente' });
  } catch (error) {
    console.error('[proyectos.eliminar]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, equipo, crear, editar, eliminar, listarPlantillas, guardarComoPlantilla };
