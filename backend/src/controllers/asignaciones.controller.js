// Maquinaria asignada a una obra, con su operador.
//
// Es lo que une las tres piezas: el proyecto (la obra), la maquina que se le
// destina, y quien la opera. Vive colgado del proyecto porque su permiso es el
// del proyecto: quien puede administrar la obra decide su maquinaria.

const prisma = require('../lib/prisma');
const { puedeAdministrar, puedeAdministrarProyecto } = require('../utils/permissions.utils');
const { registrarActividad } = require('../utils/logger');

const INCLUDE_ASIGNACION = {
  maquina: {
    select: {
      id: true, nombre: true, tipo: true, marca: true, modelo: true,
      precioDia: true, disponible: true, ubicacion: true,
      adjuntos: { select: { id: true, url: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
  operador: {
    select: {
      id: true, nombre: true, especialidad: true, disponible: true,
      zona: true, telefonoContacto: true,
      adjuntos: { select: { id: true, url: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
  creadoPor: { select: { id: true, nombre: true } },
};

const parseFecha = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = invalida
};

// El permiso es el del proyecto: si puedes administrar la obra, decides su
// maquinaria. Los MIEMBRO del proyecto tambien, porque son quienes la trabajan.
const puedeGestionarMaquinariaDe = async (usuario, proyecto) => {
  if (puedeAdministrar(usuario)) return puedeAdministrarProyecto(usuario, proyecto);
  const miembro = await prisma.proyecto.findFirst({
    where: { id: proyecto.id, miembros: { some: { id: usuario.id } } },
    select: { id: true },
  });
  return Boolean(miembro);
};

const cargarProyecto = (id) =>
  prisma.proyecto.findUnique({ where: { id }, include: { miembros: { select: { id: true } } } });

const listar = async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId)) return res.status(400).json({ error: 'Id de proyecto inválido' });

    const proyecto = await cargarProyecto(proyectoId);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const asignaciones = await prisma.asignacionMaquina.findMany({
      where: { proyectoId },
      include: INCLUDE_ASIGNACION,
      orderBy: { creadoEn: 'asc' },
    });

    return res.json({ asignaciones });
  } catch (error) {
    console.error('[asignaciones.listar]', error);
    return res.status(500).json({ error: 'No se pudo cargar la maquinaria del proyecto' });
  }
};

const crear = async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    if (!Number.isInteger(proyectoId)) return res.status(400).json({ error: 'Id de proyecto inválido' });

    const proyecto = await cargarProyecto(proyectoId);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    if (!(await puedeGestionarMaquinariaDe(req.usuario, proyecto))) {
      return res.status(403).json({ error: 'No tienes permiso para asignar maquinaria a este proyecto' });
    }

    const { maquinaId, operadorId, fechaInicio, fechaFin, notas } = req.body;

    const mid = Number(maquinaId);
    if (!Number.isInteger(mid)) return res.status(400).json({ error: 'La máquina es requerida' });

    const maquina = await prisma.maquina.findUnique({ where: { id: mid } });
    if (!maquina) return res.status(404).json({ error: 'La máquina indicada no existe' });

    let oid = null;
    if (operadorId !== undefined && operadorId !== null && operadorId !== '') {
      oid = Number(operadorId);
      if (!Number.isInteger(oid)) return res.status(400).json({ error: 'El operador indicado no es válido' });
      const operador = await prisma.operador.findUnique({ where: { id: oid }, select: { id: true } });
      if (!operador) return res.status(404).json({ error: 'El operador indicado no existe' });
    }

    const dInicio = parseFecha(fechaInicio);
    const dFin = parseFecha(fechaFin);
    if (dInicio === undefined && fechaInicio) return res.status(400).json({ error: 'Fecha de inicio inválida' });
    if (dFin === undefined && fechaFin) return res.status(400).json({ error: 'Fecha de fin inválida' });
    if (dInicio && dFin && dFin < dInicio) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio' });
    }

    const yaAsignada = await prisma.asignacionMaquina.findUnique({
      where: { proyectoId_maquinaId: { proyectoId, maquinaId: mid } },
    });
    if (yaAsignada) {
      return res.status(409).json({ error: 'Esa máquina ya está asignada a este proyecto' });
    }

    const asignacion = await prisma.asignacionMaquina.create({
      data: {
        proyectoId,
        maquinaId: mid,
        operadorId: oid,
        fechaInicio: dInicio ?? null,
        fechaFin: dFin ?? null,
        notas: notas?.trim() || null,
        creadoPorId: req.usuario.id,
      },
      include: INCLUDE_ASIGNACION,
    });

    // Firma posicional: (usuarioId, proyectoId, accion, descripcion).
    await registrarActividad(
      req.usuario.id,
      proyectoId,
      'ASIGNAR_MAQUINA',
      `asignó la máquina "${maquina.nombre}" al proyecto`,
    );

    return res.status(201).json({ asignacion });
  } catch (error) {
    console.error('[asignaciones.crear]', error);
    return res.status(500).json({ error: 'No se pudo asignar la máquina' });
  }
};

const actualizar = async (req, res) => {
  try {
    const id = Number(req.params.asignacionId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.asignacionMaquina.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Asignación no encontrada' });

    const proyecto = await cargarProyecto(actual.proyectoId);
    if (!(await puedeGestionarMaquinariaDe(req.usuario, proyecto))) {
      return res.status(403).json({ error: 'No tienes permiso para cambiar la maquinaria de este proyecto' });
    }

    const { operadorId, fechaInicio, fechaFin, notas } = req.body;

    let operadorData = {};
    if (operadorId !== undefined) {
      if (operadorId === null || operadorId === '') {
        operadorData = { operadorId: null };
      } else {
        const oid = Number(operadorId);
        if (!Number.isInteger(oid)) return res.status(400).json({ error: 'El operador indicado no es válido' });
        const operador = await prisma.operador.findUnique({ where: { id: oid }, select: { id: true } });
        if (!operador) return res.status(404).json({ error: 'El operador indicado no existe' });
        operadorData = { operadorId: oid };
      }
    }

    const dInicio = parseFecha(fechaInicio);
    const dFin = parseFecha(fechaFin);
    if (dInicio === undefined && fechaInicio) return res.status(400).json({ error: 'Fecha de inicio inválida' });
    if (dFin === undefined && fechaFin) return res.status(400).json({ error: 'Fecha de fin inválida' });

    const inicioFinal = dInicio !== undefined ? dInicio : actual.fechaInicio;
    const finFinal = dFin !== undefined ? dFin : actual.fechaFin;
    if (inicioFinal && finFinal && finFinal < inicioFinal) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la de inicio' });
    }

    const asignacion = await prisma.asignacionMaquina.update({
      where: { id },
      data: {
        ...operadorData,
        ...(fechaInicio !== undefined ? { fechaInicio: dInicio } : {}),
        ...(fechaFin !== undefined ? { fechaFin: dFin } : {}),
        ...(notas !== undefined ? { notas: notas?.trim() || null } : {}),
      },
      include: INCLUDE_ASIGNACION,
    });

    return res.json({ asignacion });
  } catch (error) {
    console.error('[asignaciones.actualizar]', error);
    return res.status(500).json({ error: 'No se pudo actualizar la asignación' });
  }
};

const eliminar = async (req, res) => {
  try {
    const id = Number(req.params.asignacionId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.asignacionMaquina.findUnique({
      where: { id },
      include: { maquina: { select: { nombre: true } } },
    });
    if (!actual) return res.status(404).json({ error: 'Asignación no encontrada' });

    const proyecto = await cargarProyecto(actual.proyectoId);
    if (!(await puedeGestionarMaquinariaDe(req.usuario, proyecto))) {
      return res.status(403).json({ error: 'No tienes permiso para retirar maquinaria de este proyecto' });
    }

    await prisma.asignacionMaquina.delete({ where: { id } });

    await registrarActividad(
      req.usuario.id,
      actual.proyectoId,
      'RETIRAR_MAQUINA',
      `retiró la máquina "${actual.maquina.nombre}" del proyecto`,
    );

    return res.json({ mensaje: 'Máquina retirada del proyecto' });
  } catch (error) {
    console.error('[asignaciones.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo retirar la máquina' });
  }
};

// Operadores a los que se puede asignar maquinaria: todas las fichas del
// catalogo. Tambien las ocupadas, porque asignar es justo lo que las ocupa.
const operadoresDisponibles = async (_req, res) => {
  try {
    const operadores = await prisma.operador.findMany({
      select: {
        id: true, nombre: true, especialidad: true, disponible: true, zona: true,
        adjuntos: { select: { id: true, url: true }, orderBy: { orden: 'asc' }, take: 1 },
      },
      orderBy: [{ disponible: 'desc' }, { nombre: 'asc' }],
    });
    return res.json({ operadores });
  } catch (error) {
    console.error('[asignaciones.operadoresDisponibles]', error);
    return res.status(500).json({ error: 'No se pudieron cargar los operadores' });
  }
};

module.exports = { listar, crear, actualizar, eliminar, operadoresDisponibles };
