const prisma = require('../lib/prisma');
const { registrarActividad } = require('../utils/logger');
const { puedeAdministrar, puedeAdministrarProyecto } = require('../utils/permissions.utils');

const listar = async (req, res) => {
  const { id: parentId } = req.params;
  const isTarea = req.baseUrl.includes('tareas');
  
  try {
    if (isTarea) {
      const tarea = await prisma.tarea.findUnique({
        where: { id: Number(parentId) },
        include: { proyecto: { select: { area: true } } }
      });
      if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
      if (puedeAdministrar(req.usuario) && !puedeAdministrarProyecto(req.usuario, tarea.proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para ver comentarios de esta tarea' });
      }
    } else {
      const proyecto = await prisma.proyecto.findUnique({ where: { id: Number(parentId) } });
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
      if (puedeAdministrar(req.usuario) && !puedeAdministrarProyecto(req.usuario, proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para ver comentarios de este proyecto' });
      }
    }

    const comentarios = await prisma.comentario.findMany({
      where: isTarea ? { tareaId: Number(parentId) } : { proyectoId: Number(parentId) },
      orderBy: { creadoEn: 'asc' },
      include: {
        autor: {
          select: { id: true, nombre: true, area: true }
        }
      }
    });
    res.json({ comentarios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crear = async (req, res) => {
  const { id: parentId } = req.params;
  const { contenido } = req.body;
  const isTarea = req.baseUrl.includes('tareas');

  if (!contenido || contenido.trim() === '') {
    return res.status(400).json({ error: 'El contenido del comentario es requerido' });
  }

  try {
    let proyectoId = null;
    let tituloRef = '';

    if (isTarea) {
      const tarea = await prisma.tarea.findUnique({ where: { id: Number(parentId) } });
      if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
      proyectoId = tarea.proyectoId;
      tituloRef = `la tarea "${tarea.titulo}"`;

      // Si es MIEMBRO, verificar que pertenece a la lista de miembros del proyecto
      if (puedeAdministrar(req.usuario)) {
        const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
        if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
          return res.status(403).json({ error: 'No tienes permiso para comentar en este proyecto' });
        }
      } else {
        const miembro = await prisma.proyecto.findFirst({
          where: { id: proyectoId, miembros: { some: { id: req.usuario.id } } }
        });
        if (!miembro) return res.status(403).json({ error: 'No tienes permiso para comentar en este proyecto' });
      }

      // Notificar al asignado
      if (tarea.asignadoId && tarea.asignadoId !== req.usuario.id) {
        await prisma.notificacion.create({
          data: {
            usuarioId: tarea.asignadoId,
            mensaje: `${req.usuario.nombre} comentó en tu tarea: "${tarea.titulo}"`,
            tipo: 'ESTADO',
            tareaId: tarea.id
          }
        });
      }
    } else {
      const proyecto = await prisma.proyecto.findUnique({ where: { id: Number(parentId) } });
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
      proyectoId = proyecto.id;
      tituloRef = `el proyecto "${proyecto.nombre}"`;

      // Si es MIEMBRO, verificar que pertenece a la lista de miembros del proyecto
      if (puedeAdministrar(req.usuario)) {
        if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
          return res.status(403).json({ error: 'No tienes permiso para comentar en este proyecto' });
        }
      } else {
        const miembro = await prisma.proyecto.findFirst({
          where: { id: proyectoId, miembros: { some: { id: req.usuario.id } } }
        });
        if (!miembro) return res.status(403).json({ error: 'No tienes permiso para comentar en este proyecto' });
      }
    }

    const comentario = await prisma.comentario.create({
      data: {
        contenido: contenido.trim(),
        tareaId: isTarea ? Number(parentId) : null,
        proyectoId: !isTarea ? Number(parentId) : null,
        autorId: req.usuario.id
      },
      include: {
        autor: {
          select: { id: true, nombre: true, area: true }
        }
      }
    });

    // Registrar en el Log de Actividad
    await registrarActividad(
      req.usuario.id,
      proyectoId,
      'NUEVO_COMENTARIO',
      `${req.usuario.nombre} comentó en ${tituloRef}`,
      isTarea ? Number(parentId) : null
    );

    res.status(201).json({ comentario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const comentario = await prisma.comentario.findUnique({ where: { id: Number(id) } });
    
    if (!comentario) return res.status(404).json({ error: 'Comentario no encontrado' });

    let proyectoScope = null;
    if (comentario.tareaId) {
      const tarea = await prisma.tarea.findUnique({
        where: { id: comentario.tareaId },
        include: { proyecto: { select: { area: true } } }
      });
      proyectoScope = tarea?.proyecto || null;
    } else if (comentario.proyectoId) {
      proyectoScope = await prisma.proyecto.findUnique({
        where: { id: comentario.proyectoId },
        select: { area: true }
      });
    }

    const adminPuedeBorrar = puedeAdministrar(req.usuario) && proyectoScope && puedeAdministrarProyecto(req.usuario, proyectoScope);

    // Solo el autor o un ADMIN con alcance pueden borrarlo
    if (comentario.autorId !== req.usuario.id && !adminPuedeBorrar) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este comentario' });
    }

    await prisma.comentario.delete({ where: { id: Number(id) } });

    // Registrar en el Log de Actividad
    let proyectoId = comentario.proyectoId;
    let desc = 'comentario';

    if (comentario.tareaId) {
      const tarea = await prisma.tarea.findUnique({ where: { id: comentario.tareaId } });
      if (tarea) {
        proyectoId = tarea.proyectoId;
        desc = `comentario en la tarea "${tarea.titulo}"`;
      }
    } else if (comentario.proyectoId) {
      const proyecto = await prisma.proyecto.findUnique({ where: { id: comentario.proyectoId } });
      if (proyecto) desc = `comentario en el proyecto "${proyecto.nombre}"`;
    }

    await registrarActividad(
      req.usuario.id,
      proyectoId,
      'ELIMINAR_COMENTARIO',
      `${req.usuario.nombre} eliminó un ${desc}`,
      comentario.tareaId || null
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listar,
  crear,
  eliminar
};
