// Controlador del Panel de noticias
//
// Entradas que publica el equipo: una maquina que entra en renta, un operador
// que se ofrece, o un aviso suelto. Es panel interno: cualquiera con sesion lee,
// pero solo el autor (o un ADMIN) toca lo suyo.

const prisma = require('../lib/prisma');
const { esAdmin } = require('../utils/permissions.utils');

const TIPOS = ['MAQUINA_RENTA', 'OPERADOR_DISPONIBLE', 'AVISO'];
const ESTADOS = ['BORRADOR', 'PUBLICADA', 'OCULTA'];
const VISIBILIDADES = ['PUBLICA', 'INTERNA'];

const INCLUDE_PUBLICACION = {
  autor: { select: { id: true, nombre: true, email: true, area: true, rol: true, fotoPerfilUrl: true } },
  maquina: {
    select: {
      id: true, nombre: true, tipo: true, marca: true, modelo: true,
      precioDia: true, disponible: true, ubicacion: true,
      adjuntos: { select: { id: true, url: true, nombre: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
  adjuntos: {
    select: { id: true, nombre: true, url: true, tipo: true, orden: true },
    orderBy: { orden: 'asc' },
  },
};

const puedeEditar = (usuario, publicacion) =>
  esAdmin(usuario) || publicacion.autorId === usuario.id;

const listar = async (req, res) => {
  try {
    const { tipo, q } = req.query;

    const publicaciones = await prisma.publicacion.findMany({
      where: {
        // Publicadas para todos; las ocultas y los borradores, solo su autor.
        // Un ADMIN ve las ocultas porque es quien modera, pero no los borradores
        // ajenos, que son trabajo a medias.
        OR: [
          { estado: 'PUBLICADA' },
          { estado: { in: ['BORRADOR', 'OCULTA'] }, autorId: req.usuario.id },
          ...(esAdmin(req.usuario) ? [{ estado: 'OCULTA' }] : []),
        ],
        ...(tipo ? { tipo } : {}),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { titulo: { contains: q, mode: 'insensitive' } },
                    { cuerpo: { contains: q, mode: 'insensitive' } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: INCLUDE_PUBLICACION,
      orderBy: { creadoEn: 'desc' },
    });

    return res.json({ publicaciones });
  } catch (error) {
    console.error('[publicaciones.listar]', error);
    return res.status(500).json({ error: 'No se pudo cargar el panel' });
  }
};

const obtener = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const publicacion = await prisma.publicacion.findUnique({ where: { id }, include: INCLUDE_PUBLICACION });
    if (!publicacion) return res.status(404).json({ error: 'Publicación no encontrada' });

    if (publicacion.estado === 'BORRADOR' && !puedeEditar(req.usuario, publicacion)) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    return res.json({ publicacion });
  } catch (error) {
    console.error('[publicaciones.obtener]', error);
    return res.status(500).json({ error: 'No se pudo cargar la publicación' });
  }
};

const crear = async (req, res) => {
  try {
    const { titulo, cuerpo, tipo, maquinaId, estado, visibilidad } = req.body;

    if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
    if (!tipo || !TIPOS.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Debe ser uno de: ${TIPOS.join(', ')}` });
    }
    if (estado && !ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    if (visibilidad && !VISIBILIDADES.includes(visibilidad)) {
      return res.status(400).json({ error: 'Visibilidad inválida' });
    }

    // Si la publicacion anuncia una maquina, esa maquina tiene que existir; si
    // no, quedaria una tarjeta apuntando a nada.
    let maquinaVinculada = null;
    if (maquinaId !== undefined && maquinaId !== null && maquinaId !== '') {
      const mid = Number(maquinaId);
      if (!Number.isInteger(mid)) return res.status(400).json({ error: 'maquinaId inválido' });
      maquinaVinculada = await prisma.maquina.findUnique({ where: { id: mid } });
      if (!maquinaVinculada) return res.status(404).json({ error: 'La máquina indicada no existe' });
    }

    const publicacion = await prisma.publicacion.create({
      data: {
        titulo: titulo.trim(),
        cuerpo: cuerpo?.trim() || null,
        tipo,
        ...(estado ? { estado } : {}),
        ...(visibilidad ? { visibilidad } : {}),
        ...(maquinaVinculada ? { maquinaId: maquinaVinculada.id } : {}),
        // El autor sale del token, no del body.
        autorId: req.usuario.id,
      },
      include: INCLUDE_PUBLICACION,
    });

    return res.status(201).json({ publicacion });
  } catch (error) {
    console.error('[publicaciones.crear]', error);
    return res.status(500).json({ error: 'No se pudo crear la publicación' });
  }
};

const actualizar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.publicacion.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Publicación no encontrada' });

    if (!puedeEditar(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el autor puede editar esta publicación' });
    }

    const { titulo, cuerpo, tipo, maquinaId, estado, visibilidad } = req.body;

    if (titulo !== undefined && !titulo.trim()) {
      return res.status(400).json({ error: 'El título no puede quedar vacío' });
    }
    if (tipo !== undefined && !TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (estado !== undefined && !ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    if (visibilidad !== undefined && !VISIBILIDADES.includes(visibilidad)) {
      return res.status(400).json({ error: 'Visibilidad inválida' });
    }

    let maquinaData = {};
    if (maquinaId !== undefined) {
      if (maquinaId === null || maquinaId === '') {
        maquinaData = { maquinaId: null };
      } else {
        const mid = Number(maquinaId);
        if (!Number.isInteger(mid)) return res.status(400).json({ error: 'maquinaId inválido' });
        const existe = await prisma.maquina.findUnique({ where: { id: mid } });
        if (!existe) return res.status(404).json({ error: 'La máquina indicada no existe' });
        maquinaData = { maquinaId: mid };
      }
    }

    const publicacion = await prisma.publicacion.update({
      where: { id },
      data: {
        ...(titulo !== undefined ? { titulo: titulo.trim() } : {}),
        ...(cuerpo !== undefined ? { cuerpo: cuerpo?.trim() || null } : {}),
        ...(tipo !== undefined ? { tipo } : {}),
        ...(estado !== undefined ? { estado } : {}),
        ...(visibilidad !== undefined ? { visibilidad } : {}),
        ...maquinaData,
      },
      include: INCLUDE_PUBLICACION,
    });

    return res.json({ publicacion });
  } catch (error) {
    console.error('[publicaciones.actualizar]', error);
    return res.status(500).json({ error: 'No se pudo actualizar la publicación' });
  }
};

const eliminar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.publicacion.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Publicación no encontrada' });

    if (!puedeEditar(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el autor puede eliminar esta publicación' });
    }

    await prisma.publicacion.delete({ where: { id } });
    return res.json({ mensaje: 'Publicación eliminada' });
  } catch (error) {
    console.error('[publicaciones.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo eliminar la publicación' });
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
