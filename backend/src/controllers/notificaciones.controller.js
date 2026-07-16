const prisma = require('../lib/prisma');

const listar = async (req, res) => {
  try {
    const notificacionesBase = await prisma.notificacion.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { creadaEn: 'desc' },
      take: 20,
    });

    const tareaIds = [...new Set(
      notificacionesBase
        .map((notificacion) => notificacion.tareaId)
        .filter((value) => Number.isInteger(value))
    )];

    const tareas = tareaIds.length > 0
      ? await prisma.tarea.findMany({
          where: { id: { in: tareaIds } },
          select: {
            id: true,
            titulo: true,
            proyectoId: true,
            creadorId: true,
            asignadoId: true,
            creador: {
              select: { id: true, nombre: true },
            },
            proyecto: {
              select: { id: true, nombre: true },
            },
          },
        })
      : [];

    const tareasMap = new Map(tareas.map((tarea) => [tarea.id, tarea]));
    const extraerActorNombre = (mensaje = '') => {
      const patrones = [
        /^(.*?) te ha invitado a:/i,
        /^(.*?) coment[oó] en tu tarea:/i,
      ];

      for (const patron of patrones) {
        const match = mensaje.match(patron);
        if (match?.[1]) return match[1].trim();
      }

      return null;
    };

    const notificaciones = notificacionesBase.map((notificacion) => {
      const tarea = notificacion.tareaId ? tareasMap.get(notificacion.tareaId) || null : null;
      return {
        ...notificacion,
        tarea,
        proyecto: tarea?.proyecto || null,
        actorNombre: extraerActorNombre(notificacion.mensaje) || tarea?.creador?.nombre || null,
      };
    });

    res.json({ notificaciones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notificacion.updateMany({
      where: { id: Number(id), usuarioId: req.usuario.id },
      data: { leida: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    await prisma.notificacion.updateMany({
      where: { usuarioId: req.usuario.id, leida: false },
      data: { leida: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notificacion.deleteMany({
      where: { id: Number(id), usuarioId: req.usuario.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listar,
  marcarLeida,
  marcarTodasLeidas,
  eliminar
};
