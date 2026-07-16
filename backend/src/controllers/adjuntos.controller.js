const prisma = require('../lib/prisma');
const { registrarActividad } = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { put, del } = require('@vercel/blob');
const { esAdmin, puedeAdministrarProyecto } = require('../utils/permissions.utils');

// Detecta si una "url" guardada es una URL absoluta de Vercel Blob
// (los adjuntos antiguos guardaban solo el nombre de archivo en disco).
const esUrlAbsoluta = (valor) => /^https?:\/\//i.test(valor || '');

const getEntityType = (req) => {
  if (req.baseUrl.includes('agenda')) return 'agenda';
  if (req.baseUrl.includes('proyectos')) return 'proyectos';
  return 'tareas';
};

const getFilesFromRequest = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat();
  }
  return [];
};

const canAccessEvento = (evento, usuarioId) => (
  evento.usuarioId === usuarioId ||
  evento.creadoPorId === usuarioId ||
  evento.esGlobal ||
  (evento.invitados || []).some((invitado) => invitado.usuarioId === usuarioId)
);

const canManageEvento = (evento, usuarioId) => (
  evento.usuarioId === usuarioId || evento.creadoPorId === usuarioId
);

const buildActivityPayload = async ({ entityType, parentId, reqUsuario, adjunto, tituloRef }) => {
  if (entityType === 'tareas') {
    const tarea = await prisma.tarea.findUnique({ where: { id: Number(parentId) } });
    return {
      proyectoId: tarea?.proyectoId || null,
      tareaId: Number(parentId),
      descripcion: `${reqUsuario.nombre} subio ${adjunto.length > 1 ? `${adjunto.length} archivos` : `el archivo "${adjunto[0].nombre}"`} a ${tituloRef}`,
    };
  }

  if (entityType === 'proyectos') {
    return {
      proyectoId: Number(parentId),
      tareaId: null,
      descripcion: `${reqUsuario.nombre} subio ${adjunto.length > 1 ? `${adjunto.length} archivos` : `el archivo "${adjunto[0].nombre}"`} a ${tituloRef}`,
    };
  }

  const evento = await prisma.evento.findUnique({
    where: { id: String(parentId) },
    select: { proyectoId: true, titulo: true },
  });

  if (!evento?.proyectoId) return null;

  return {
    proyectoId: evento.proyectoId,
    tareaId: null,
    descripcion: `${reqUsuario.nombre} subio ${adjunto.length > 1 ? `${adjunto.length} archivos` : `el archivo "${adjunto[0].nombre}"`} al evento "${evento.titulo}"`,
  };
};

const listar = async (req, res) => {
  const { id: parentId } = req.params;
  const entityType = getEntityType(req);

  try {
    if (entityType === 'tareas') {
      const tarea = await prisma.tarea.findUnique({
        where: { id: Number(parentId) },
        include: { proyecto: { select: { area: true } } },
      });
      if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
      if (esAdmin(req.usuario) && !puedeAdministrarProyecto(req.usuario, tarea.proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para ver adjuntos de esta tarea' });
      }
    } else if (entityType === 'proyectos') {
      const proyecto = await prisma.proyecto.findUnique({ where: { id: Number(parentId) } });
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
      if (esAdmin(req.usuario) && !puedeAdministrarProyecto(req.usuario, proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para ver adjuntos de este proyecto' });
      }
    } else {
      const evento = await prisma.evento.findUnique({
        where: { id: String(parentId) },
        include: { invitados: { select: { usuarioId: true } } },
      });
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      if (!canAccessEvento(evento, req.usuario.id)) {
        return res.status(403).json({ error: 'No tienes permiso para ver adjuntos de este evento' });
      }
    }

    const where = entityType === 'tareas'
      ? { tareaId: Number(parentId) }
      : entityType === 'proyectos'
        ? { proyectoId: Number(parentId), tareaId: null, eventoId: null }
        : { eventoId: String(parentId) };

    const adjuntos = await prisma.adjunto.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
    });

    res.json({ adjuntos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subir = async (req, res) => {
  const { id: parentId } = req.params;
  const entityType = getEntityType(req);
  const files = getFilesFromRequest(req);

  if (files.length === 0) {
    return res.status(400).json({ error: 'No se subio ningun archivo' });
  }

  try {
    let createBase = {};
    let tituloRef = '';

    if (entityType === 'tareas') {
      const tarea = await prisma.tarea.findUnique({ where: { id: Number(parentId) } });
      if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
      tituloRef = `la tarea "${tarea.titulo}"`;
      createBase = { tareaId: Number(parentId), proyectoId: null, eventoId: null };

      if (esAdmin(req.usuario)) {
        const proyecto = await prisma.proyecto.findUnique({ where: { id: tarea.proyectoId } });
        if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
          return res.status(403).json({ error: 'No tienes permiso para subir archivos a esta tarea' });
        }
      } else {
        const miembro = await prisma.proyecto.findFirst({
          where: { id: tarea.proyectoId, miembros: { some: { id: req.usuario.id } } },
        });
        if (!miembro) return res.status(403).json({ error: 'No tienes permiso para subir archivos a esta tarea' });
      }
    } else if (entityType === 'proyectos') {
      const proyecto = await prisma.proyecto.findUnique({ where: { id: Number(parentId) } });
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
      tituloRef = `el proyecto "${proyecto.nombre}"`;
      createBase = { proyectoId: Number(parentId), tareaId: null, eventoId: null };

      if (esAdmin(req.usuario)) {
        if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
          return res.status(403).json({ error: 'No tienes permiso para subir archivos a este proyecto' });
        }
      } else {
        const miembro = await prisma.proyecto.findFirst({
          where: { id: proyecto.id, miembros: { some: { id: req.usuario.id } } },
        });
        if (!miembro) return res.status(403).json({ error: 'No tienes permiso para subir archivos a este proyecto' });
      }
    } else {
      const evento = await prisma.evento.findUnique({
        where: { id: String(parentId) },
        include: { invitados: { select: { usuarioId: true } } },
      });
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      if (!canManageEvento(evento, req.usuario.id)) {
        return res.status(403).json({ error: 'No tienes permiso para subir archivos a este evento' });
      }
      tituloRef = `el evento "${evento.titulo}"`;
      createBase = { eventoId: String(parentId), tareaId: null, proyectoId: null };
    }

    const createdAdjuntos = [];
    for (const file of files) {
      const ext = path.extname(file.originalname);
      const blobName = `adjuntos/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const blob = await put(blobName, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
      });

      const adjunto = await prisma.adjunto.create({
        data: {
          nombre: file.originalname,
          url: blob.url,
          tipo: file.mimetype,
          tamano: file.size,
          usuarioId: req.usuario.id,
          ...createBase,
        },
        include: {
          usuario: { select: { id: true, nombre: true } },
        },
      });
      createdAdjuntos.push(adjunto);
    }

    const actividad = await buildActivityPayload({
      entityType,
      parentId,
      reqUsuario: req.usuario,
      adjunto: createdAdjuntos,
      tituloRef,
    });

    if (actividad?.proyectoId) {
      await registrarActividad(
        req.usuario.id,
        actividad.proyectoId,
        'SUBIR_ARCHIVO',
        actividad.descripcion,
        actividad.tareaId
      );
    }

    res.status(201).json({
      adjunto: createdAdjuntos[0],
      adjuntos: createdAdjuntos,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const adjunto = await prisma.adjunto.findUnique({
      where: { id: Number(id) },
      include: {
        tarea: true,
        evento: {
          include: {
            invitados: { select: { usuarioId: true } },
          },
        },
      },
    });

    if (!adjunto) return res.status(404).json({ error: 'Archivo no encontrado' });

    let proyectoScope = null;
    if (adjunto.tarea) {
      proyectoScope = await prisma.proyecto.findUnique({
        where: { id: adjunto.tarea.proyectoId },
        select: { area: true },
      });
    } else if (adjunto.proyectoId) {
      proyectoScope = await prisma.proyecto.findUnique({
        where: { id: adjunto.proyectoId },
        select: { area: true },
      });
    }

    const adminPuedeBorrar = esAdmin(req.usuario) && proyectoScope && puedeAdministrarProyecto(req.usuario, proyectoScope);
    const puedeBorrarEvento = adjunto.evento && canManageEvento(adjunto.evento, req.usuario.id);

    if (adjunto.usuarioId !== req.usuario.id && !adminPuedeBorrar && !puedeBorrarEvento) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este archivo' });
    }

    if (esUrlAbsoluta(adjunto.url)) {
      // Archivo en Vercel Blob
      try {
        await del(adjunto.url);
      } catch (_error) {
        // Si el blob ya no existe, continuamos con el borrado en BD igualmente.
      }
    } else {
      // Compatibilidad con adjuntos antiguos guardados en disco
      const filePath = path.join(__dirname, '../../uploads', adjunto.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.adjunto.delete({ where: { id: Number(id) } });

    let proyectoId = adjunto.proyectoId;
    let desc = `archivo "${adjunto.nombre}"`;

    if (adjunto.tarea) {
      proyectoId = adjunto.tarea.proyectoId;
      desc += ` de la tarea "${adjunto.tarea.titulo}"`;
    } else if (adjunto.proyectoId) {
      const proyecto = await prisma.proyecto.findUnique({ where: { id: adjunto.proyectoId } });
      if (proyecto) desc += ` del proyecto "${proyecto.nombre}"`;
    } else if (adjunto.evento) {
      proyectoId = adjunto.evento.proyectoId;
      desc += ` del evento "${adjunto.evento.titulo}"`;
    }

    if (proyectoId) {
      await registrarActividad(
        req.usuario.id,
        proyectoId,
        'ELIMINAR_ARCHIVO',
        `${req.usuario.nombre} elimino el ${desc}`,
        adjunto.tareaId || null
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const descargar = async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../uploads', filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Archivo no encontrado fisicamente' });
  }
};

const ver = async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../uploads', filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Archivo no encontrado fisicamente' });
  }
};

module.exports = {
  listar,
  subir,
  eliminar,
  descargar,
  ver,
};
