const prisma = require('../lib/prisma');
const { sortTareas } = require('../utils/sort.utils');
const { buildScopeProyectoVisible, administraUnArea } = require('../utils/permissions.utils');

const finDelDia = (fecha) => {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
};

const finDeSemana = (fecha) => {
  const d = finDelDia(fecha);
  const diasHastaDomingo = 6 - d.getDay();
  d.setDate(d.getDate() + diasHastaDomingo);
  return d;
};

const inicioDeSemana = (fecha) => {
  const d = new Date(fecha);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const tareaResumenSelect = {
  id: true,
  titulo: true,
  numeroActividad: true,
  estado: true,
  prioridad: true,
  creadoEn: true,
  completadoEn: true,
  venceEn: true,
  fechaInicio: true,
  asignadoId: true,
  creadorId: true,
  proyecto: {
    select: { id: true, nombre: true }
  }
};

const resumenTarea = (tarea) => ({
  id: tarea.id,
  titulo: tarea.titulo,
  numeroActividad: tarea.numeroActividad,
  estado: tarea.estado,
  prioridad: tarea.prioridad,
  creadoEn: tarea.creadoEn,
  completadoEn: tarea.completadoEn,
  venceEn: tarea.venceEn,
  fechaInicio: tarea.fechaInicio,
  proyecto: tarea.proyecto
});

const getFinTareaOcupacion = (tarea) => (
  tarea.venceEn ? tarea.venceEn : (tarea.completadoEn || tarea.fechaInicio || tarea.creadoEn)
);

const resumenOcupacionTarea = (tarea) => ({
  id: `tarea-${tarea.id}`,
  origenId: tarea.id,
  tipo: 'tarea',
  titulo: tarea.titulo,
  estado: tarea.estado,
  prioridad: tarea.prioridad,
  fechaInicio: tarea.fechaInicio || tarea.creadoEn,
  fechaFin: getFinTareaOcupacion(tarea),
  proyecto: tarea.proyecto || null,
});

const resumenOcupacionProyecto = (proyecto, usuarioId) => ({
  id: `proyecto-${proyecto.id}-${usuarioId}`,
  origenId: proyecto.id,
  tipo: 'proyecto',
  titulo: `Proyecto: ${proyecto.nombre}`,
  estado: proyecto.estado,
  prioridad: null,
  fechaInicio: proyecto.fechaInicio || proyecto.creadoEn,
  fechaFin: proyecto.fechaFin || proyecto.fechaInicio || proyecto.creadoEn,
  proyecto: { id: proyecto.id, nombre: proyecto.nombre },
});

const resumenOcupacionEvento = (evento) => ({
  id: `evento-${evento.id}`,
  origenId: evento.id,
  tipo: evento.tipo === 'reunion' ? 'reunion' : 'evento',
  titulo: evento.titulo,
  estado: null,
  prioridad: null,
  fechaInicio: evento.fechaInicio,
  fechaFin: evento.fechaFin || evento.fechaInicio,
  proyecto: evento.proyecto || null,
});

const buildProjectScopeWhere = (scopeProyecto) => (
  scopeProyecto ? { proyecto: scopeProyecto } : {}
);

const getTopUsuariosProductividad = async (usuario) => {
  const hoy = new Date();
  const inicioSemanaActual = inicioDeSemana(hoy);
  const semanasAnalizadas = 4;
  const inicioVentana = new Date(inicioSemanaActual);
  inicioVentana.setDate(inicioVentana.getDate() - ((semanasAnalizadas - 1) * 7));
  const filtroAreaUsuarios = administraUnArea(usuario) ? { area: usuario.area } : {};
  const scopeProyecto = buildScopeProyectoVisible(usuario);

  const [miembros, tareasHechas] = await Promise.all([
    prisma.usuario.findMany({
      where: { rol: 'FEDERACION', ...filtroAreaUsuarios },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, area: true }
    }),
    prisma.tarea.findMany({
      where: {
        estado: 'HECHO',
        completadoEn: { gte: inicioVentana },
        ...(scopeProyecto ? { proyecto: scopeProyecto } : {})
      },
      select: {
        id: true,
        asignadoId: true,
        creadorId: true,
        completadoEn: true
      }
    })
  ]);

  return miembros
    .map((miembro) => {
      const hechas = tareasHechas.filter((tarea) => tarea.asignadoId === miembro.id || tarea.creadorId === miembro.id);
      const hechasSemanaActual = hechas.filter((tarea) => tarea.completadoEn >= inicioSemanaActual).length;
      const promedioSemanal = Number((hechas.length / semanasAnalizadas).toFixed(1));

      return {
        id: miembro.id,
        nombre: miembro.nombre,
        area: miembro.area,
        promedioSemanal,
        hechasSemanaActual,
        totalVentana: hechas.length
      };
    })
    .sort((a, b) =>
      b.promedioSemanal - a.promedioSemanal
      || b.hechasSemanaActual - a.hechasSemanaActual
      || a.nombre.localeCompare(b.nombre))
    .slice(0, 5);
};

const getActividadMiembros = async (usuario) => {
  const ahora = new Date();
  const hoyFin = finDelDia(ahora);
  const hoyInicio = new Date(ahora);
  hoyInicio.setHours(0, 0, 0, 0);
  const semanaFin = finDeSemana(ahora);
  const calendarioInicio = new Date(ahora);
  calendarioInicio.setMonth(calendarioInicio.getMonth() - 6);
  calendarioInicio.setHours(0, 0, 0, 0);
  const calendarioFin = new Date(ahora);
  calendarioFin.setMonth(calendarioFin.getMonth() + 12);
  calendarioFin.setHours(23, 59, 59, 999);
  const filtroAreaUsuarios = administraUnArea(usuario) ? { area: usuario.area } : {};
  const scopeProyecto = buildScopeProyectoVisible(usuario);
  const projectScopeWhere = buildProjectScopeWhere(scopeProyecto);

  const miembros = await prisma.usuario.findMany({
    where: { rol: 'FEDERACION', ...filtroAreaUsuarios },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, area: true }
  });

  if (!miembros.length) return [];

  const memberIds = miembros.map((miembro) => miembro.id);

  const [todasLasTareas, proyectosActivos, eventosAgenda] = await Promise.all([
    prisma.tarea.findMany({
      where: {
        OR: [
          { asignadoId: { in: memberIds } },
          { creadorId: { in: memberIds } },
        ],
        ...projectScopeWhere,
      },
      select: tareaResumenSelect,
    }),
    prisma.proyecto.findMany({
      where: {
        estado: { not: 'CERRADO' },
        OR: [
          { miembros: { some: { id: { in: memberIds } } } },
          { creadorId: { in: memberIds } },
        ],
        ...(scopeProyecto || {}),
      },
      select: {
        id: true,
        nombre: true,
        estado: true,
        creadoEn: true,
        fechaInicio: true,
        fechaFin: true,
        creadorId: true,
        miembros: { select: { id: true } },
      },
    }),
    prisma.evento.findMany({
      where: {
        AND: [
          {
            OR: [
              { usuarioId: { in: memberIds } },
              { creadoPorId: { in: memberIds } },
              { invitados: { some: { usuarioId: { in: memberIds }, estado: 'aceptado' } } },
            ],
          },
          { fechaInicio: { lte: calendarioFin } },
          {
            OR: [
              { fechaFin: { gte: calendarioInicio } },
              { fechaFin: null, fechaInicio: { gte: calendarioInicio } },
            ],
          },
        ],
      },
      select: {
        id: true,
        titulo: true,
        tipo: true,
        fechaInicio: true,
        fechaFin: true,
        usuarioId: true,
        creadoPorId: true,
        invitados: {
          where: { estado: 'aceptado', usuarioId: { in: memberIds } },
          select: { usuarioId: true },
        },
        proyecto: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  const tareasPorMiembro = new Map(memberIds.map((id) => [id, []]));
  todasLasTareas.forEach((tarea) => {
    if (tarea.asignadoId && tareasPorMiembro.has(tarea.asignadoId)) {
      tareasPorMiembro.get(tarea.asignadoId).push(tarea);
    }
    if (
      tarea.creadorId
      && tarea.creadorId !== tarea.asignadoId
      && tareasPorMiembro.has(tarea.creadorId)
    ) {
      tareasPorMiembro.get(tarea.creadorId).push(tarea);
    }
  });

  const proyectosPorMiembro = new Map(memberIds.map((id) => [id, []]));
  proyectosActivos.forEach((proyecto) => {
    const relacionados = new Set([
      proyecto.creadorId,
      ...proyecto.miembros.map((miembro) => miembro.id),
    ]);
    relacionados.forEach((memberId) => {
      if (proyectosPorMiembro.has(memberId)) {
        proyectosPorMiembro.get(memberId).push(proyecto);
      }
    });
  });

  const eventosPorMiembro = new Map(memberIds.map((id) => [id, []]));
  eventosAgenda.forEach((evento) => {
    const relacionados = new Set([
      evento.usuarioId,
      evento.creadoPorId,
      ...evento.invitados.map((invitado) => invitado.usuarioId),
    ]);
    relacionados.forEach((memberId) => {
      if (eventosPorMiembro.has(memberId)) {
        eventosPorMiembro.get(memberId).push(evento);
      }
    });
  });

  return miembros.map((miembro) => {
    const tareasDelMiembro = tareasPorMiembro.get(miembro.id) || [];
    const hechas = tareasDelMiembro.filter((tarea) => tarea.estado === 'HECHO');
    const hechasHoy = hechas.filter((tarea) => tarea.completadoEn && tarea.completadoEn >= hoyInicio);
    const enProgreso = tareasDelMiembro.filter((tarea) => tarea.estado === 'EN_PROGRESO');
    const faltanHoy = tareasDelMiembro.filter((tarea) => tarea.estado === 'PENDIENTE');
    const faltanSemana = tareasDelMiembro.filter((tarea) =>
      tarea.estado !== 'HECHO'
      && tarea.venceEn
      && tarea.venceEn > hoyFin
      && tarea.venceEn <= semanaFin
    );
    const proyectosDelMiembro = proyectosPorMiembro.get(miembro.id) || [];
    const eventosDelMiembro = eventosPorMiembro.get(miembro.id) || [];

    const ocupacionCalendario = [
      ...proyectosDelMiembro.map((proyecto) => resumenOcupacionProyecto(proyecto, miembro.id)),
      ...tareasDelMiembro.map(resumenOcupacionTarea),
      ...eventosDelMiembro.map(resumenOcupacionEvento),
    ].filter((item) => item.fechaInicio && item.fechaFin);

    return {
      id: miembro.id,
      nombre: miembro.nombre,
      area: miembro.area,
      hechasHoy: sortTareas(hechasHoy).map(resumenTarea),
      enProgreso: sortTareas(enProgreso).map(resumenTarea),
      faltanHoy: sortTareas(faltanHoy).map(resumenTarea),
      faltanSemana: sortTareas(faltanSemana).map(resumenTarea),
      todasConFecha: tareasDelMiembro.map(resumenTarea),
      ocupacionCalendario,
      totales: {
        totalTareas: tareasDelMiembro.length,
        hechasHoy: hechasHoy.length,
        enProgreso: enProgreso.length,
        faltanHoy: faltanHoy.length,
        faltanSemana: faltanSemana.length,
        totalHechas: hechas.length,
        pendientes: tareasDelMiembro.filter((tarea) => tarea.estado === 'PENDIENTE').length,
        porcentajeCumplimiento: tareasDelMiembro.length > 0
          ? Math.round((hechas.length / tareasDelMiembro.length) * 100)
          : 0,
      },
    };
  });
};

const getMemberStats = async (req, res) => {
  try {
    const proyectos = await prisma.proyecto.findMany({
      where: {
        OR: [
          { miembros: { some: { id: req.usuario.id } } },
          { creadorId: req.usuario.id },
          { tareas: { some: { asignadoId: req.usuario.id } } },
          { tareas: { some: { creadorId: req.usuario.id } } },
        ],
      },
      orderBy: { creadoEn: 'desc' },
      include: {
        creador: { select: { id: true, nombre: true, area: true } },
        miembros: { select: { id: true, nombre: true, email: true, area: true, rol: true } },
        _count: { select: { tareas: true } },
        tareas: {
          select: { estado: true, asignadoId: true },
        },
      },
    });

    const proyectosConProgreso = proyectos.map((proyecto) => {
      const total = proyecto.tareas.length;
      const hechas = proyecto.tareas.filter((tarea) => tarea.estado === 'HECHO').length;
      const tareasMiembro = proyecto.tareas.filter((tarea) => tarea.asignadoId === req.usuario.id);
      const hechasMiembro = tareasMiembro.filter((tarea) => tarea.estado === 'HECHO').length;
      const { tareas, ...resto } = proyecto;

      return {
        ...resto,
        progreso: total > 0 ? Math.round((hechas / total) * 100) : 0,
        progresoGeneral: total > 0 ? Math.round((hechas / total) * 100) : 0,
        progresoMiembro: tareasMiembro.length > 0
          ? Math.round((hechasMiembro / tareasMiembro.length) * 100)
          : 0,
        tareasMiembro: tareasMiembro.length,
      };
    });

    const resumenTareas = proyectos.reduce((acc, proyecto) => {
      proyecto.tareas.forEach((tarea) => {
        acc.total += 1;
        if (tarea.estado === 'HECHO') acc.hechas += 1;
        if (tarea.estado === 'PENDIENTE') acc.pendientes += 1;
        if (tarea.estado === 'EN_PROGRESO') acc.enProgreso += 1;
      });
      return acc;
    }, {
      total: 0,
      hechas: 0,
      pendientes: 0,
      enProgreso: 0,
    });

    const tareas = await prisma.tarea.findMany({
      where: {
        proyectoId: { in: proyectos.map((proyecto) => proyecto.id) },
        OR: [
          { asignadoId: req.usuario.id },
          { creadorId: req.usuario.id },
        ],
      },
      orderBy: { creadoEn: 'asc' },
      include: {
        asignado: { select: { id: true, nombre: true, email: true, area: true } },
        creador: { select: { id: true, nombre: true, email: true, area: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    });

    return res.json({
      proyectos: proyectosConProgreso,
      tareas: sortTareas(tareas),
      resumenTareas,
    });
  } catch (error) {
    console.error('[stats.getMemberStats]', error);
    return res.status(500).json({ error: 'Error al generar estadisticas del miembro' });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const scopeProyecto = buildScopeProyectoVisible(req.usuario);

    // 1. Estadísticas de Proyectos
    const totalProyectos = await prisma.proyecto.count({ where: scopeProyecto || undefined });
    const proyectosPorEstado = await prisma.proyecto.groupBy({
      by: ['estado'],
      where: scopeProyecto || undefined,
      _count: true
    });

    // 2. Estadísticas de Tareas
    const totalTareas = await prisma.tarea.count({ where: scopeProyecto ? { proyecto: scopeProyecto } : undefined });
    const tareasPorEstado = await prisma.tarea.groupBy({
      by: ['estado'],
      where: scopeProyecto ? { proyecto: scopeProyecto } : undefined,
      _count: true
    });

    // 3. Top Usuarios (Productividad)
    // Usuarios con más tareas completadas
    const topUsuarios = await getTopUsuariosProductividad(req.usuario);

    // 4. Actividad Reciente
    const actividadReciente = await prisma.logActividad.findMany({
      take: 8,
      where: scopeProyecto ? { proyecto: scopeProyecto } : undefined,
      orderBy: { creadoEn: 'desc' },
      include: {
        usuario: { select: { nombre: true, area: true } }
      }
    });

    // 5. Proyectos con más progreso (Top 5 activos)
    const proyectosActivos = await prisma.proyecto.findMany({
      where: scopeProyecto || undefined,
      include: {
        _count: { select: { tareas: true } },
        tareas: {
          select: { id: true, estado: true }
        },
        miembros: {
          select: { id: true }
        },
      }
    });

    const proyectosProgreso = proyectosActivos.map(p => {
      const total = p._count.tareas;
      const completas = p.tareas.filter((tarea) => tarea.estado === 'HECHO').length;
      const pendientes = p.tareas.filter((tarea) => tarea.estado === 'PENDIENTE').length;
      const enProgreso = p.tareas.filter((tarea) => tarea.estado === 'EN_PROGRESO').length;
      return {
        id: p.id,
        nombre: p.nombre,
        estado: p.estado,
        totalTareas: total,
        completas,
        pendientes,
        enProgreso,
        miembros: p.miembros.length,
        porcentaje: total > 0 ? Math.round((completas / total) * 100) : 0
      };
    }).sort((a, b) =>
      b.porcentaje - a.porcentaje
      || b.completas - a.completas
      || a.nombre.localeCompare(b.nombre)
    );

    const actividadMiembros = await getActividadMiembros(req.usuario);

    res.json({
      proyectos: {
        total: totalProyectos,
        estados: proyectosPorEstado
      },
      tareas: {
        total: totalTareas,
        estados: tareasPorEstado
      },
      topUsuarios,
      actividadReciente,
      proyectosProgreso,
      actividadMiembros
    });

  } catch (error) {
    console.error('[stats.getAdminStats]', error);
    res.status(500).json({ error: 'Error al generar estadísticas' });
  }
};

module.exports = { getAdminStats, getMemberStats };
