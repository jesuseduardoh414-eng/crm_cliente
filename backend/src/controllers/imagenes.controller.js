// Imagenes de maquinas, publicaciones y fichas de operador.
//
// Reutiliza el modelo Adjunto y Vercel Blob, igual que los adjuntos de tareas y
// proyectos. Va en su propio controlador y no dentro de adjuntos.controller
// porque aquel resuelve la entidad con un if/else sobre tarea/proyecto/evento y
// cada rama tiene su propio modelo de permisos; aqui el permiso es "eres el
// dueño", que no encaja en esa cadena.

const prisma = require('../lib/prisma');
const { guardarArchivo, borrarArchivo } = require('../services/storage.service');
const { puedeAdministrar } = require('../utils/permissions.utils');

const MAX_IMAGENES = 8;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const getFiles = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') return Object.values(req.files).flat();
  return [];
};

// Cada entidad que tiene galeria: de que tabla se carga, en que columna de
// Adjunto cuelga, y quien es su dueño.
const ENTIDADES = {
  publicaciones: {
    entidad: 'publicacion',
    campo: 'publicacionId',
    cargar: (id) => prisma.publicacion.findUnique({ where: { id } }),
    duenoId: (padre) => padre.autorId,
  },
  operadores: {
    entidad: 'operador',
    campo: 'operadorId',
    cargar: (id) => prisma.operador.findUnique({ where: { id } }),
    duenoId: (padre) => padre.registradoPorId,
  },
  maquinas: {
    entidad: 'maquina',
    campo: 'maquinaId',
    cargar: (id) => prisma.maquina.findUnique({ where: { id } }),
    duenoId: (padre) => padre.propietarioId,
  },
};

// Devuelve la config de la entidad segun la ruta desde la que se llama.
const resolverEntidad = (req) => {
  const clave = Object.keys(ENTIDADES).find((k) => req.baseUrl.includes(k));
  return ENTIDADES[clave] || ENTIDADES.maquinas;
};

const esDueno = (config, padre, usuario) =>
  puedeAdministrar(usuario) || config.duenoId(padre) === usuario.id;

const listar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const config = resolverEntidad(req);
    const { campo } = config;
    const padre = await config.cargar(id);
    if (!padre) return res.status(404).json({ error: 'No encontrado' });

    const imagenes = await prisma.adjunto.findMany({
      where: { [campo]: id },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, url: true, tipo: true, tamano: true, orden: true, creadoEn: true },
    });

    return res.json({ imagenes });
  } catch (error) {
    console.error('[imagenes.listar]', error);
    return res.status(500).json({ error: 'No se pudieron cargar las imágenes' });
  }
};

const subir = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const config = resolverEntidad(req);
    const { entidad, campo } = config;
    const padre = await config.cargar(id);
    if (!padre) return res.status(404).json({ error: 'No encontrado' });

    if (!esDueno(config, padre, req.usuario)) {
      return res.status(403).json({ error: 'Solo el propietario puede subir imágenes' });
    }

    const files = getFiles(req);
    if (files.length === 0) return res.status(400).json({ error: 'No se subió ninguna imagen' });

    // Aqui solo entran imagenes: es una galeria, no un cajon de archivos.
    const invalido = files.find((f) => !TIPOS_PERMITIDOS.includes(f.mimetype));
    if (invalido) {
      return res.status(400).json({ error: `Tipo no permitido: ${invalido.mimetype}. Solo imágenes.` });
    }

    const yaHay = await prisma.adjunto.count({ where: { [campo]: id } });
    if (yaHay + files.length > MAX_IMAGENES) {
      return res.status(400).json({ error: `Máximo ${MAX_IMAGENES} imágenes (ya hay ${yaHay})` });
    }

    // El orden continua desde la ultima: la primera imagen hace de portada y no
    // debe cambiar porque alguien suba otra despues.
    const ultima = await prisma.adjunto.findFirst({
      where: { [campo]: id },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });
    let orden = (ultima?.orden ?? -1) + 1;

    const creadas = [];
    for (const file of files) {
      const url = await guardarArchivo(file, `${entidad}s/${id}`);

      const adjunto = await prisma.adjunto.create({
        data: {
          nombre: file.originalname,
          url,
          tipo: file.mimetype,
          tamano: file.size,
          orden: orden++,
          usuarioId: req.usuario.id,
          [campo]: id,
        },
        select: { id: true, nombre: true, url: true, tipo: true, tamano: true, orden: true },
      });
      creadas.push(adjunto);
    }

    return res.status(201).json({ imagenes: creadas });
  } catch (error) {
    console.error('[imagenes.subir]', error);
    return res.status(500).json({ error: 'No se pudieron subir las imágenes' });
  }
};

const eliminar = async (req, res) => {
  try {
    const id = Number(req.params.imagenId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const imagen = await prisma.adjunto.findUnique({ where: { id } });
    if (!imagen) return res.status(404).json({ error: 'Imagen no encontrada' });

    const config = resolverEntidad(req);
    const padreId = imagen[config.campo];
    if (!padreId) return res.status(404).json({ error: 'Imagen no encontrada' });

    const padre = await config.cargar(padreId);
    if (!padre || !esDueno(config, padre, req.usuario)) {
      return res.status(403).json({ error: 'Solo el propietario puede eliminar imágenes' });
    }

    // Primero el archivo y luego la fila: al reves, un fallo dejaria el archivo
    // huerfano en el almacenamiento sin nadie que lo referencie.
    await borrarArchivo(imagen.url);
    await prisma.adjunto.delete({ where: { id } });
    return res.json({ mensaje: 'Imagen eliminada' });
  } catch (error) {
    console.error('[imagenes.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo eliminar la imagen' });
  }
};

// Reordena la galeria; el cliente manda los ids en el orden deseado.
const reordenar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const config = resolverEntidad(req);
    const { campo } = config;
    const padre = await config.cargar(id);
    if (!padre) return res.status(404).json({ error: 'No encontrado' });

    if (!esDueno(config, padre, req.usuario)) {
      return res.status(403).json({ error: 'Solo el propietario puede reordenar' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids debe ser un arreglo' });
    }

    // Solo se reordena lo que pertenece a este padre: si no, un id ajeno
    // colado en la lista movería la imagen de otro.
    const propias = await prisma.adjunto.findMany({ where: { [campo]: id }, select: { id: true } });
    const permitidos = new Set(propias.map((p) => p.id));
    const filtrados = ids.map(Number).filter((i) => permitidos.has(i));

    if (filtrados.length !== ids.length) {
      return res.status(400).json({ error: 'Hay ids que no pertenecen a este elemento' });
    }

    await prisma.$transaction(
      filtrados.map((imagenId, i) =>
        prisma.adjunto.update({ where: { id: imagenId }, data: { orden: i } }),
      ),
    );

    const imagenes = await prisma.adjunto.findMany({
      where: { [campo]: id },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, url: true, tipo: true, orden: true },
    });

    return res.json({ imagenes });
  } catch (error) {
    console.error('[imagenes.reordenar]', error);
    return res.status(500).json({ error: 'No se pudieron reordenar las imágenes' });
  }
};

module.exports = { listar, subir, eliminar, reordenar };
