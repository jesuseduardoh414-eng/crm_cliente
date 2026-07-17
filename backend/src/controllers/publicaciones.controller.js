// Controlador del Panel de noticias
//
// Una noticia no es solo un texto que se lee. Al publicarse abre la tarea que
// le da seguimiento —que hay una retro libre significa que alguien tiene que
// colocarla—, y si convoca una reunion, la mete en el calendario del equipo.
// Es panel interno: cualquiera con sesion lee, pero solo el autor (o la mesa)
// toca lo suyo.

const prisma = require('../lib/prisma');
const { puedeAdministrar } = require('../utils/permissions.utils');
const { crearReunion, actualizarReunion, cancelarReunion } = require('../services/reuniones.service');

const TIPOS = ['MAQUINA_RENTA', 'OPERADOR_DISPONIBLE', 'REUNION', 'AVISO'];
const ESTADOS = ['BORRADOR', 'PUBLICADA', 'OCULTA'];
const VISIBILIDADES = ['PUBLICA', 'INTERNA'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA'];

const INCLUDE_PUBLICACION = {
  autor: { select: { id: true, nombre: true, email: true, area: true, rol: true, fotoPerfilUrl: true } },
  maquina: {
    select: {
      id: true, nombre: true, tipo: true, marca: true, modelo: true,
      precioDia: true, disponible: true, ubicacion: true,
      adjuntos: { select: { id: true, url: true, nombre: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
  operador: {
    select: {
      id: true, nombre: true, especialidad: true, disponible: true,
      zona: true, telefonoContacto: true, tarifaHora: true,
      adjuntos: { select: { id: true, url: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
  evento: {
    select: {
      id: true, fechaInicio: true, fechaFin: true, modalidad: true,
      ubicacion: true, urlReunion: true, esGlobal: true,
      invitados: { select: { usuarioId: true, estado: true } },
    },
  },
  // La tarea que abrio esta noticia, para poder saltar a ella desde el panel.
  tarea: { select: { id: true, titulo: true, estado: true, asignadoId: true } },
  adjuntos: {
    select: { id: true, nombre: true, url: true, tipo: true, orden: true },
    orderBy: { orden: 'asc' },
  },
};

const puedeEditar = (usuario, publicacion) =>
  puedeAdministrar(usuario) || publicacion.autorId === usuario.id;

// Que pendiente abre cada tipo de noticia. El titulo de la tarea no es el de la
// noticia: la noticia informa ("hay una retro libre") y la tarea manda ("coloca
// la retro").
const TAREA_POR_TIPO = {
  MAQUINA_RENTA: { prefijo: 'Colocar maquinaria', prioridad: 'ALTA' },
  OPERADOR_DISPONIBLE: { prefijo: 'Asignar operador', prioridad: 'ALTA' },
  REUNION: { prefijo: 'Preparar reunión', prioridad: 'MEDIA' },
  AVISO: { prefijo: 'Dar seguimiento', prioridad: 'MEDIA' },
};

// La tarea que abre una noticia publicada.
//
// Sin proyecto a proposito: es trabajo del panel, no de una obra. Se crea una
// sola vez —el unique de publicacionId lo garantiza— para que republicar no
// llene el tablero de duplicados.
const abrirTareaDe = async (publicacion, autorId) => {
  const yaExiste = await prisma.tarea.findUnique({
    where: { publicacionId: publicacion.id },
    select: { id: true },
  });
  if (yaExiste) return yaExiste;

  const plantilla = TAREA_POR_TIPO[publicacion.tipo] || TAREA_POR_TIPO.AVISO;

  try {
    return await prisma.tarea.create({
      data: {
        titulo: `${plantilla.prefijo}: ${publicacion.titulo}`,
        descripcion: publicacion.cuerpo || null,
        prioridad: plantilla.prioridad,
        estado: 'PENDIENTE',
        proyectoId: null,
        publicacionId: publicacion.id,
        creadorId: autorId,
        maquinaId: publicacion.maquinaId || null,
        // Una reunion vence cuando se celebra; el resto queda abierto hasta que
        // alguien lo cierre.
        venceEn: publicacion.evento?.fechaInicio || null,
      },
      select: { id: true, titulo: true, estado: true, asignadoId: true },
    });
  } catch (error) {
    // Que falle la tarea no puede tumbar la publicacion: la noticia ya es util
    // por si misma y el pendiente se puede abrir a mano.
    console.error('[publicaciones.abrirTarea]', error);
    return null;
  }
};

const listar = async (req, res) => {
  try {
    const { tipo, q } = req.query;

    if (tipo && !TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });

    const publicaciones = await prisma.publicacion.findMany({
      where: {
        // Publicadas para todos; las ocultas y los borradores, solo su autor.
        // Un ADMIN ve las ocultas porque es quien modera, pero no los borradores
        // ajenos, que son trabajo a medias.
        OR: [
          { estado: 'PUBLICADA' },
          { estado: { in: ['BORRADOR', 'OCULTA'] }, autorId: req.usuario.id },
          ...(puedeAdministrar(req.usuario) ? [{ estado: 'OCULTA' }] : []),
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

// Comprueba que lo que la noticia dice enlazar existe de verdad; si no,
// quedaria una tarjeta apuntando a nada.
const resolverEnlace = async (campo, valor) => {
  if (valor === undefined) return { valor: undefined };
  if (valor === null || valor === '') return { valor: null };

  const id = Number(valor);
  if (!Number.isInteger(id)) return { error: `${campo} inválido` };

  const existe = campo === 'maquinaId'
    ? await prisma.maquina.findUnique({ where: { id }, select: { id: true } })
    : await prisma.operador.findUnique({ where: { id }, select: { id: true } });

  if (!existe) {
    return { error: campo === 'maquinaId' ? 'La máquina indicada no existe' : 'El operador indicado no existe' };
  }
  return { valor: id };
};

const crear = async (req, res) => {
  try {
    const {
      titulo, cuerpo, tipo, maquinaId, operadorId, estado, visibilidad,
      // Solo para las reuniones
      fechaInicio, fechaFin, modalidad, ubicacion, urlReunion, invitadosIds, esGlobal,
    } = req.body;

    if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
    if (!tipo || !TIPOS.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Debe ser uno de: ${TIPOS.join(', ')}` });
    }
    if (estado && !ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    if (visibilidad && !VISIBILIDADES.includes(visibilidad)) {
      return res.status(400).json({ error: 'Visibilidad inválida' });
    }

    const maquina = await resolverEnlace('maquinaId', maquinaId);
    if (maquina.error) return res.status(400).json({ error: maquina.error });

    const operador = await resolverEnlace('operadorId', operadorId);
    if (operador.error) return res.status(400).json({ error: operador.error });

    const estadoFinal = estado || 'PUBLICADA';

    // La reunion se convoca al publicar, no antes: un borrador no puede llenar
    // el calendario de nadie.
    let eventoId = null;
    if (tipo === 'REUNION' && estadoFinal === 'PUBLICADA') {
      const { evento, error } = await crearReunion({
        titulo: titulo.trim(),
        descripcion: cuerpo?.trim() || null,
        fechaInicio,
        fechaFin,
        modalidad,
        ubicacion,
        urlReunion,
        invitadosIds,
        esGlobal,
        creadorId: req.usuario.id,
      });
      if (error) return res.status(400).json({ error });
      eventoId = evento.id;
    }

    const publicacion = await prisma.publicacion.create({
      data: {
        titulo: titulo.trim(),
        cuerpo: cuerpo?.trim() || null,
        tipo,
        estado: estadoFinal,
        ...(visibilidad ? { visibilidad } : {}),
        ...(maquina.valor ? { maquinaId: maquina.valor } : {}),
        ...(operador.valor ? { operadorId: operador.valor } : {}),
        ...(eventoId ? { eventoId } : {}),
        // El autor sale del token, no del body.
        autorId: req.usuario.id,
      },
      include: INCLUDE_PUBLICACION,
    });

    if (estadoFinal === 'PUBLICADA') {
      const tarea = await abrirTareaDe(publicacion, req.usuario.id);
      return res.status(201).json({ publicacion: { ...publicacion, tarea } });
    }

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

    const {
      titulo, cuerpo, tipo, maquinaId, operadorId, estado, visibilidad,
      fechaInicio, fechaFin, modalidad, ubicacion, urlReunion, invitadosIds, esGlobal,
    } = req.body;

    if (titulo !== undefined && !titulo.trim()) {
      return res.status(400).json({ error: 'El título no puede quedar vacío' });
    }
    if (tipo !== undefined && !TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (estado !== undefined && !ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    if (visibilidad !== undefined && !VISIBILIDADES.includes(visibilidad)) {
      return res.status(400).json({ error: 'Visibilidad inválida' });
    }

    const maquina = await resolverEnlace('maquinaId', maquinaId);
    if (maquina.error) return res.status(400).json({ error: maquina.error });

    const operador = await resolverEnlace('operadorId', operadorId);
    if (operador.error) return res.status(400).json({ error: operador.error });

    const tipoFinal = tipo ?? actual.tipo;
    const estadoFinal = estado ?? actual.estado;
    const tituloFinal = titulo !== undefined ? titulo.trim() : actual.titulo;
    const cuerpoFinal = cuerpo !== undefined ? (cuerpo?.trim() || null) : actual.cuerpo;

    // La reunion sigue a su noticia: si se publica ahora, se convoca; si cambia
    // la fecha, se reprograma; si deja de ser reunion, se cancela. Sin esto, el
    // calendario acabaria contando otra cosa que el panel.
    let eventoData = {};
    if (tipoFinal === 'REUNION' && estadoFinal === 'PUBLICADA') {
      if (actual.eventoId) {
        const { error } = await actualizarReunion(actual.eventoId, {
          titulo: tituloFinal,
          descripcion: cuerpoFinal,
          fechaInicio,
          fechaFin,
          modalidad,
          ubicacion,
          urlReunion,
        });
        if (error) return res.status(400).json({ error });
      } else {
        const { evento, error } = await crearReunion({
          titulo: tituloFinal,
          descripcion: cuerpoFinal,
          fechaInicio,
          fechaFin,
          modalidad,
          ubicacion,
          urlReunion,
          invitadosIds,
          esGlobal,
          creadorId: req.usuario.id,
        });
        if (error) return res.status(400).json({ error });
        eventoData = { eventoId: evento.id };
      }
    } else if (actual.eventoId && (tipoFinal !== 'REUNION' || estadoFinal !== 'PUBLICADA')) {
      await cancelarReunion(actual.eventoId);
      eventoData = { eventoId: null };
    }

    const publicacion = await prisma.publicacion.update({
      where: { id },
      data: {
        ...(titulo !== undefined ? { titulo: tituloFinal } : {}),
        ...(cuerpo !== undefined ? { cuerpo: cuerpoFinal } : {}),
        ...(tipo !== undefined ? { tipo } : {}),
        ...(estado !== undefined ? { estado } : {}),
        ...(visibilidad !== undefined ? { visibilidad } : {}),
        ...(maquina.valor !== undefined ? { maquinaId: maquina.valor } : {}),
        ...(operador.valor !== undefined ? { operadorId: operador.valor } : {}),
        ...eventoData,
      },
      include: INCLUDE_PUBLICACION,
    });

    // Un borrador que se publica abre su tarea ahora.
    if (estadoFinal === 'PUBLICADA' && !publicacion.tarea) {
      const tarea = await abrirTareaDe(publicacion, publicacion.autorId);
      return res.json({ publicacion: { ...publicacion, tarea } });
    }

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

    // La tarea cae con la noticia (Cascade). La reunion tambien se cancela:
    // borrar la convocatoria y dejar la cita en el calendario de todos seria
    // peor que no borrar nada.
    if (actual.eventoId) await cancelarReunion(actual.eventoId);

    await prisma.publicacion.delete({ where: { id } });
    return res.json({ mensaje: 'Publicación eliminada' });
  } catch (error) {
    console.error('[publicaciones.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo eliminar la publicación' });
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
