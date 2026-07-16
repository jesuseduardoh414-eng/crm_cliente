// Controlador de Maquinaria en renta
// Ver    -> cualquier usuario autenticado (es panel interno)
// Editar -> solo el propietario de la maquina, o un ADMIN

const prisma = require('../lib/prisma');
const { esAdmin } = require('../utils/permissions.utils');

const INCLUDE_MAQUINA = {
  propietario: { select: { id: true, nombre: true, email: true, area: true, fotoPerfilUrl: true } },
  adjuntos: {
    select: { id: true, nombre: true, url: true, tipo: true, orden: true },
    orderBy: { orden: 'asc' },
  },
  // Cuantas tareas sin terminar la usan: es el aviso de "esta comprometida".
  _count: {
    select: { tareas: { where: { estado: { not: 'HECHO' } } } },
  },
};

// El detalle si trae las tareas y sus proyectos: es lo que conecta el catalogo
// con el trabajo real y evita que maquinaria sea un modulo aislado.
const INCLUDE_MAQUINA_DETALLE = {
  ...INCLUDE_MAQUINA,
  tareas: {
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      fechaInicio: true,
      venceEn: true,
      proyecto: { select: { id: true, nombre: true, estado: true } },
      asignados: { select: { id: true, nombre: true, rol: true } },
    },
    orderBy: [{ estado: 'asc' }, { venceEn: 'asc' }],
  },
};

const ESTADOS = ['BORRADOR', 'PUBLICADA', 'OCULTA'];

// A diferencia de los proyectos, aqui el permiso no depende del rol sino de
// quien la dio de alta: en un catalogo compartido cualquiera puede consultar,
// pero solo el dueño toca lo suyo.
const puedeEditarMaquina = (usuario, maquina) =>
  esAdmin(usuario) || maquina.propietarioId === usuario.id;

// El precio llega como texto desde el formulario; Prisma espera un Decimal
// valido o null. Un string vacio no es 0.
const parsePrecio = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = invalido
};

const listar = async (req, res) => {
  try {
    const { tipo, disponible, q } = req.query;

    const where = {
      // Los borradores solo los ve su autor: son maquinas a medio dar de alta.
      OR: [
        { estado: { in: ['PUBLICADA', 'OCULTA'] } },
        { estado: 'BORRADOR', propietarioId: req.usuario.id },
      ],
      ...(tipo ? { tipo } : {}),
      ...(disponible !== undefined ? { disponible: disponible === 'true' } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { nombre: { contains: q, mode: 'insensitive' } },
                  { marca: { contains: q, mode: 'insensitive' } },
                  { modelo: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    const maquinas = await prisma.maquina.findMany({
      where,
      include: INCLUDE_MAQUINA,
      orderBy: [{ disponible: 'desc' }, { creadoEn: 'desc' }],
    });

    return res.json({ maquinas });
  } catch (error) {
    console.error('[maquinas.listar]', error);
    return res.status(500).json({ error: 'No se pudieron cargar las máquinas' });
  }
};

const obtener = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const maquina = await prisma.maquina.findUnique({ where: { id }, include: INCLUDE_MAQUINA_DETALLE });
    if (!maquina) return res.status(404).json({ error: 'Máquina no encontrada' });

    if (maquina.estado === 'BORRADOR' && !puedeEditarMaquina(req.usuario, maquina)) {
      return res.status(404).json({ error: 'Máquina no encontrada' });
    }

    return res.json({ maquina });
  } catch (error) {
    console.error('[maquinas.obtener]', error);
    return res.status(500).json({ error: 'No se pudo cargar la máquina' });
  }
};

const crear = async (req, res) => {
  try {
    const { nombre, tipo, marca, modelo, anio, descripcion, precioDia, ubicacion, disponible, estado } = req.body;

    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!tipo?.trim()) return res.status(400).json({ error: 'El tipo es requerido' });

    const precio = parsePrecio(precioDia);
    if (precio === undefined) return res.status(400).json({ error: 'El precio por día no es válido' });

    if (estado && !ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const maquina = await prisma.maquina.create({
      data: {
        nombre: nombre.trim(),
        tipo: tipo.trim(),
        marca: marca?.trim() || null,
        modelo: modelo?.trim() || null,
        anio: anio ? Number(anio) : null,
        descripcion: descripcion?.trim() || null,
        precioDia: precio,
        ubicacion: ubicacion?.trim() || null,
        disponible: disponible !== undefined ? Boolean(disponible) : true,
        ...(estado ? { estado } : {}),
        // El propietario sale del token, nunca del body: si no, cualquiera
        // podria dar de alta una maquina a nombre de otro.
        propietarioId: req.usuario.id,
      },
      include: INCLUDE_MAQUINA,
    });

    return res.status(201).json({ maquina });
  } catch (error) {
    console.error('[maquinas.crear]', error);
    return res.status(500).json({ error: 'No se pudo crear la máquina' });
  }
};

const actualizar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.maquina.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Máquina no encontrada' });

    if (!puedeEditarMaquina(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el propietario puede editar esta máquina' });
    }

    const { nombre, tipo, marca, modelo, anio, descripcion, precioDia, ubicacion, disponible, estado } = req.body;

    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    }
    if (estado !== undefined && !ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    let precio;
    if (precioDia !== undefined) {
      precio = parsePrecio(precioDia);
      if (precio === undefined) return res.status(400).json({ error: 'El precio por día no es válido' });
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(tipo !== undefined ? { tipo: tipo.trim() } : {}),
        ...(marca !== undefined ? { marca: marca?.trim() || null } : {}),
        ...(modelo !== undefined ? { modelo: modelo?.trim() || null } : {}),
        ...(anio !== undefined ? { anio: anio ? Number(anio) : null } : {}),
        ...(descripcion !== undefined ? { descripcion: descripcion?.trim() || null } : {}),
        ...(precioDia !== undefined ? { precioDia: precio } : {}),
        ...(ubicacion !== undefined ? { ubicacion: ubicacion?.trim() || null } : {}),
        ...(disponible !== undefined ? { disponible: Boolean(disponible) } : {}),
        ...(estado !== undefined ? { estado } : {}),
      },
      include: INCLUDE_MAQUINA,
    });

    return res.json({ maquina });
  } catch (error) {
    console.error('[maquinas.actualizar]', error);
    return res.status(500).json({ error: 'No se pudo actualizar la máquina' });
  }
};

// Atajo para el caso mas frecuente: marcarla libre u ocupada sin abrir el
// formulario entero.
const cambiarDisponibilidad = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.maquina.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Máquina no encontrada' });

    if (!puedeEditarMaquina(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el propietario puede cambiar esta máquina' });
    }

    const { disponible } = req.body;
    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ error: 'disponible debe ser true o false' });
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: { disponible },
      include: INCLUDE_MAQUINA,
    });

    return res.json({ maquina });
  } catch (error) {
    console.error('[maquinas.cambiarDisponibilidad]', error);
    return res.status(500).json({ error: 'No se pudo cambiar la disponibilidad' });
  }
};

const eliminar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.maquina.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Máquina no encontrada' });

    if (!puedeEditarMaquina(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el propietario puede eliminar esta máquina' });
    }

    // Los adjuntos caen por onDelete: Cascade; las publicaciones que la citaban
    // se quedan con maquinaId a null (SetNull) para no perder el historial.
    await prisma.maquina.delete({ where: { id } });

    return res.json({ mensaje: 'Máquina eliminada' });
  } catch (error) {
    console.error('[maquinas.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo eliminar la máquina' });
  }
};

// Catalogo de tipos ya usados, para alimentar el filtro sin inventar una tabla.
const tipos = async (_req, res) => {
  try {
    const filas = await prisma.maquina.findMany({
      distinct: ['tipo'],
      select: { tipo: true },
      orderBy: { tipo: 'asc' },
    });
    return res.json({ tipos: filas.map((f) => f.tipo) });
  } catch (error) {
    console.error('[maquinas.tipos]', error);
    return res.status(500).json({ error: 'No se pudieron cargar los tipos' });
  }
};

module.exports = { listar, obtener, crear, actualizar, cambiarDisponibilidad, eliminar, tipos };
