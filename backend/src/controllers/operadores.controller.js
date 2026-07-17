// Controlador de Operadores
//
// Un operador es una ficha, no una cuenta: cualquier miembro da de alta al que
// conoce y el resto del equipo lo califica, lo recomienda y deja constancia de
// lo que pasa con el. Quien la dio de alta responde por ella y es quien puede
// editarla; la mesa directiva puede corregir cualquiera.

const prisma = require('../lib/prisma');
const { puedeAdministrar } = require('../utils/permissions.utils');

const TIPOS_REPORTE = ['OBSERVACION', 'REPORTE'];
const ESTADOS_REPORTE = ['ABIERTO', 'REVISADO', 'DESCARTADO'];

const SELECT_AUTOR = { id: true, nombre: true, area: true, rol: true, fotoPerfilUrl: true };

const INCLUDE_OPERADOR = {
  registradoPor: { select: SELECT_AUTOR },
  adjuntos: { select: { id: true, url: true, nombre: true }, orderBy: { orden: 'asc' }, take: 1 },
};

const puedeEditarFicha = (usuario, operador) =>
  puedeAdministrar(usuario) || operador.registradoPorId === usuario.id;

const parseTarifa = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = invalido
};

const parseExperiencia = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? n : undefined; // undefined = invalido
};

// Best-effort: que falle el aviso no puede tumbar la accion que lo provoca.
const avisar = async (usuarioId, actorId, mensaje, tipo = 'OPERADOR') => {
  if (!usuarioId || usuarioId === actorId) return;
  try {
    await prisma.notificacion.create({ data: { usuarioId, mensaje, tipo } });
  } catch (error) {
    console.error('[operadores.avisar]', error);
  }
};

// El resumen de reputacion de varios operadores en tres consultas, no en una
// por ficha: el listado carga decenas y no puede hacer N+1.
const resumenDe = async (operadorIds) => {
  if (operadorIds.length === 0) return new Map();

  const [calificaciones, recomendaciones, reportes] = await Promise.all([
    prisma.calificacionOperador.groupBy({
      by: ['operadorId'],
      where: { operadorId: { in: operadorIds } },
      _avg: { puntuacion: true },
      _count: { _all: true },
    }),
    prisma.calificacionOperador.groupBy({
      by: ['operadorId'],
      where: { operadorId: { in: operadorIds }, recomendable: true },
      _count: { _all: true },
    }),
    prisma.reporteOperador.groupBy({
      by: ['operadorId'],
      where: { operadorId: { in: operadorIds }, tipo: 'REPORTE', estado: 'ABIERTO' },
      _count: { _all: true },
    }),
  ]);

  const mapaRecomienda = new Map(recomendaciones.map((r) => [r.operadorId, r._count._all]));
  const mapaReportes = new Map(reportes.map((r) => [r.operadorId, r._count._all]));

  const resumen = new Map();
  operadorIds.forEach((id) => {
    const cal = calificaciones.find((c) => c.operadorId === id);
    resumen.set(id, {
      // Redondeado a un decimal: "4.3" dice lo mismo que "4.2857142857".
      promedio: cal?._avg.puntuacion != null ? Math.round(cal._avg.puntuacion * 10) / 10 : null,
      totalCalificaciones: cal?._count._all || 0,
      recomiendan: mapaRecomienda.get(id) || 0,
      reportesAbiertos: mapaReportes.get(id) || 0,
    });
  });

  return resumen;
};

const conResumen = async (operadores) => {
  const resumen = await resumenDe(operadores.map((o) => o.id));
  return operadores.map((o) => ({ ...o, resumen: resumen.get(o.id) }));
};

// Listado. Por defecto solo los disponibles, que es la pregunta real ("quien
// puede trabajar"); ?todos=true los trae todos.
const listar = async (req, res) => {
  try {
    const { todos, especialidad, zona, q } = req.query;

    const operadores = await prisma.operador.findMany({
      where: {
        ...(todos === 'true' ? {} : { disponible: true }),
        ...(especialidad ? { especialidad: { contains: especialidad, mode: 'insensitive' } } : {}),
        ...(zona ? { zona: { contains: zona, mode: 'insensitive' } } : {}),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { especialidad: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: INCLUDE_OPERADOR,
      orderBy: [{ disponible: 'desc' }, { creadoEn: 'desc' }],
    });

    return res.json({ operadores: await conResumen(operadores) });
  } catch (error) {
    console.error('[operadores.listar]', error);
    return res.status(500).json({ error: 'No se pudieron cargar los operadores' });
  }
};

const obtener = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const operador = await prisma.operador.findUnique({
      where: { id },
      include: {
        ...INCLUDE_OPERADOR,
        calificaciones: {
          include: { autor: { select: SELECT_AUTOR } },
          orderBy: { creadoEn: 'desc' },
        },
        reportes: {
          include: {
            autor: { select: SELECT_AUTOR },
            revisadoPor: { select: { id: true, nombre: true } },
          },
          orderBy: { creadoEn: 'desc' },
        },
      },
    });
    if (!operador) return res.status(404).json({ error: 'Operador no encontrado' });

    const resumen = await resumenDe([id]);
    return res.json({ operador: { ...operador, resumen: resumen.get(id) } });
  } catch (error) {
    console.error('[operadores.obtener]', error);
    return res.status(500).json({ error: 'No se pudo cargar el operador' });
  }
};

// Cualquiera con sesion puede dar de alta al operador que conoce: de eso trata
// tener un catalogo de operadores del que fiarse.
const crear = async (req, res) => {
  try {
    const { nombre, especialidad, descripcion, zona, telefonoContacto, tarifaHora, experienciaAnios, disponible } = req.body;

    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!especialidad?.trim()) return res.status(400).json({ error: 'La especialidad es requerida' });

    const tarifa = parseTarifa(tarifaHora);
    if (tarifa === undefined) return res.status(400).json({ error: 'La tarifa por hora no es válida' });

    const experiencia = parseExperiencia(experienciaAnios);
    if (experiencia === undefined) return res.status(400).json({ error: 'Los años de experiencia no son válidos' });

    const operador = await prisma.operador.create({
      data: {
        nombre: nombre.trim(),
        especialidad: especialidad.trim(),
        descripcion: descripcion?.trim() || null,
        zona: zona?.trim() || null,
        telefonoContacto: telefonoContacto?.trim() || null,
        tarifaHora: tarifa,
        experienciaAnios: experiencia,
        disponible: disponible !== undefined ? Boolean(disponible) : true,
        // Sale del token, no del body: nadie da de alta una ficha a nombre de otro.
        registradoPorId: req.usuario.id,
      },
      include: INCLUDE_OPERADOR,
    });

    return res.status(201).json({ operador: { ...operador, resumen: { promedio: null, totalCalificaciones: 0, recomiendan: 0, reportesAbiertos: 0 } } });
  } catch (error) {
    console.error('[operadores.crear]', error);
    return res.status(500).json({ error: 'No se pudo dar de alta el operador' });
  }
};

const actualizar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.operador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Operador no encontrado' });

    if (!puedeEditarFicha(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo quien dio de alta al operador o la mesa directiva pueden editarlo' });
    }

    const { nombre, especialidad, descripcion, zona, telefonoContacto, tarifaHora, experienciaAnios, disponible } = req.body;

    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    }
    if (especialidad !== undefined && !especialidad.trim()) {
      return res.status(400).json({ error: 'La especialidad no puede quedar vacía' });
    }

    let tarifa;
    if (tarifaHora !== undefined) {
      tarifa = parseTarifa(tarifaHora);
      if (tarifa === undefined) return res.status(400).json({ error: 'La tarifa por hora no es válida' });
    }

    let experiencia;
    if (experienciaAnios !== undefined) {
      experiencia = parseExperiencia(experienciaAnios);
      if (experiencia === undefined) return res.status(400).json({ error: 'Los años de experiencia no son válidos' });
    }

    const operador = await prisma.operador.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(especialidad !== undefined ? { especialidad: especialidad.trim() } : {}),
        ...(descripcion !== undefined ? { descripcion: descripcion?.trim() || null } : {}),
        ...(zona !== undefined ? { zona: zona?.trim() || null } : {}),
        ...(telefonoContacto !== undefined ? { telefonoContacto: telefonoContacto?.trim() || null } : {}),
        ...(tarifaHora !== undefined ? { tarifaHora: tarifa } : {}),
        ...(experienciaAnios !== undefined ? { experienciaAnios: experiencia } : {}),
        ...(disponible !== undefined ? { disponible: Boolean(disponible) } : {}),
      },
      include: INCLUDE_OPERADOR,
    });

    const resumen = await resumenDe([id]);
    return res.json({ operador: { ...operador, resumen: resumen.get(id) } });
  } catch (error) {
    console.error('[operadores.actualizar]', error);
    return res.status(500).json({ error: 'No se pudo actualizar el operador' });
  }
};

// Atajo para lo que cambia a diario: si esta libre u ocupado.
const cambiarDisponibilidad = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.operador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Operador no encontrado' });

    if (!puedeEditarFicha(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo quien dio de alta al operador o la mesa directiva pueden cambiar su disponibilidad' });
    }

    const { disponible } = req.body;
    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ error: 'disponible debe ser true o false' });
    }

    const operador = await prisma.operador.update({
      where: { id },
      data: { disponible },
      include: INCLUDE_OPERADOR,
    });

    const resumen = await resumenDe([id]);
    return res.json({ operador: { ...operador, resumen: resumen.get(id) } });
  } catch (error) {
    console.error('[operadores.cambiarDisponibilidad]', error);
    return res.status(500).json({ error: 'No se pudo cambiar la disponibilidad' });
  }
};

const eliminar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.operador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Operador no encontrado' });

    if (!puedeEditarFicha(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo quien dio de alta al operador o la mesa directiva pueden darlo de baja' });
    }

    // Calificaciones, reportes y adjuntos caen con la ficha (Cascade). Las
    // asignaciones de maquinaria no: la obra se queda sin operador, no sin obra.
    await prisma.operador.delete({ where: { id } });
    return res.json({ mensaje: 'Operador dado de baja' });
  } catch (error) {
    console.error('[operadores.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo dar de baja el operador' });
  }
};

// ── Calificaciones ────────────────────────────────────────────────────────

const listarCalificaciones = async (req, res) => {
  try {
    const operadorId = Number(req.params.id);
    if (!Number.isInteger(operadorId)) return res.status(400).json({ error: 'Id inválido' });

    const calificaciones = await prisma.calificacionOperador.findMany({
      where: { operadorId },
      include: { autor: { select: SELECT_AUTOR } },
      orderBy: { creadoEn: 'desc' },
    });

    const resumen = await resumenDe([operadorId]);
    return res.json({ calificaciones, resumen: resumen.get(operadorId) });
  } catch (error) {
    console.error('[operadores.listarCalificaciones]', error);
    return res.status(500).json({ error: 'No se pudieron cargar las calificaciones' });
  }
};

// Upsert y no create: un miembro tiene una sola opinion por operador, y
// cambiar de idea es editarla. Con create, el unique devolveria un 409 que el
// frontend tendria que traducir a "ya votaste".
const calificar = async (req, res) => {
  try {
    const operadorId = Number(req.params.id);
    if (!Number.isInteger(operadorId)) return res.status(400).json({ error: 'Id inválido' });

    const operador = await prisma.operador.findUnique({ where: { id: operadorId } });
    if (!operador) return res.status(404).json({ error: 'Operador no encontrado' });

    // Quien sube la ficha no se califica a si mismo: seria juez y parte, y el
    // promedio dejaria de significar nada.
    if (operador.registradoPorId === req.usuario.id) {
      return res.status(403).json({ error: 'No puedes calificar a un operador que tú diste de alta' });
    }

    const { puntuacion, recomendable, comentario } = req.body;

    const nota = Number(puntuacion);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({ error: 'La puntuación debe ser un número entero del 1 al 5' });
    }
    if (typeof recomendable !== 'boolean') {
      return res.status(400).json({ error: 'Indica si lo recomiendas o no' });
    }

    const datos = {
      puntuacion: nota,
      recomendable,
      comentario: comentario?.trim() || null,
    };

    const calificacion = await prisma.calificacionOperador.upsert({
      where: { operadorId_autorId: { operadorId, autorId: req.usuario.id } },
      create: { operadorId, autorId: req.usuario.id, ...datos },
      update: datos,
      include: { autor: { select: SELECT_AUTOR } },
    });

    // Aviso a quien subio la ficha: si le van a calificar al operador, se entera.
    await avisar(
      operador.registradoPorId,
      req.usuario.id,
      `${req.usuario.nombre} calificó a ${operador.nombre} con ${nota}/5`,
    );

    const resumen = await resumenDe([operadorId]);
    return res.status(201).json({ calificacion, resumen: resumen.get(operadorId) });
  } catch (error) {
    console.error('[operadores.calificar]', error);
    return res.status(500).json({ error: 'No se pudo guardar la calificación' });
  }
};

const eliminarCalificacion = async (req, res) => {
  try {
    const operadorId = Number(req.params.id);
    if (!Number.isInteger(operadorId)) return res.status(400).json({ error: 'Id inválido' });

    const calificacion = await prisma.calificacionOperador.findUnique({
      where: { operadorId_autorId: { operadorId, autorId: req.usuario.id } },
    });
    if (!calificacion) return res.status(404).json({ error: 'No has calificado a este operador' });

    await prisma.calificacionOperador.delete({ where: { id: calificacion.id } });

    const resumen = await resumenDe([operadorId]);
    return res.json({ mensaje: 'Calificación eliminada', resumen: resumen.get(operadorId) });
  } catch (error) {
    console.error('[operadores.eliminarCalificacion]', error);
    return res.status(500).json({ error: 'No se pudo eliminar la calificación' });
  }
};

// ── Reportes y observaciones ──────────────────────────────────────────────

const listarReportes = async (req, res) => {
  try {
    const operadorId = Number(req.params.id);
    if (!Number.isInteger(operadorId)) return res.status(400).json({ error: 'Id inválido' });

    const { tipo, estado } = req.query;
    if (tipo && !TIPOS_REPORTE.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (estado && !ESTADOS_REPORTE.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const reportes = await prisma.reporteOperador.findMany({
      where: { operadorId, ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) },
      include: {
        autor: { select: SELECT_AUTOR },
        revisadoPor: { select: { id: true, nombre: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    return res.json({ reportes });
  } catch (error) {
    console.error('[operadores.listarReportes]', error);
    return res.status(500).json({ error: 'No se pudieron cargar los reportes' });
  }
};

const reportar = async (req, res) => {
  try {
    const operadorId = Number(req.params.id);
    if (!Number.isInteger(operadorId)) return res.status(400).json({ error: 'Id inválido' });

    const operador = await prisma.operador.findUnique({ where: { id: operadorId } });
    if (!operador) return res.status(404).json({ error: 'Operador no encontrado' });

    const { tipo, contenido } = req.body;

    if (tipo !== undefined && !TIPOS_REPORTE.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Debe ser uno de: ${TIPOS_REPORTE.join(', ')}` });
    }
    if (!contenido?.trim()) return res.status(400).json({ error: 'Escribe qué ocurrió' });

    const reporte = await prisma.reporteOperador.create({
      data: {
        operadorId,
        autorId: req.usuario.id,
        tipo: tipo || 'OBSERVACION',
        contenido: contenido.trim(),
      },
      include: { autor: { select: SELECT_AUTOR } },
    });

    const esReporte = reporte.tipo === 'REPORTE';

    // A quien subio la ficha siempre; a los ADMIN solo los reportes, que son
    // los que alguien tiene que revisar.
    await avisar(
      operador.registradoPorId,
      req.usuario.id,
      `${req.usuario.nombre} ${esReporte ? 'reportó' : 'dejó una observación sobre'} a ${operador.nombre}`,
    );

    if (esReporte) {
      // A la mesa directiva, que es quien resuelve los reportes. El consejo lo
      // ve en la ficha si quiere, pero no se le avisa: no modera.
      const mesa = await prisma.usuario.findMany({
        where: { rol: 'MESA_DIRECTIVA', estado: 'activo', id: { not: operador.registradoPorId } },
        select: { id: true },
      });
      await Promise.all(
        mesa.map((m) => avisar(m.id, req.usuario.id, `${req.usuario.nombre} reportó al operador ${operador.nombre}`)),
      );
    }

    return res.status(201).json({ reporte });
  } catch (error) {
    console.error('[operadores.reportar]', error);
    return res.status(500).json({ error: 'No se pudo registrar el reporte' });
  }
};

// Cerrar un reporte es moderar, y eso es de la mesa directiva: si lo pudiera cerrar
// quien subio la ficha, se archivaria a si mismo las quejas.
const resolverReporte = async (req, res) => {
  try {
    const id = Number(req.params.reporteId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    if (!puedeAdministrar(req.usuario)) {
      return res.status(403).json({ error: 'Solo la mesa directiva puede resolver reportes' });
    }

    const actual = await prisma.reporteOperador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Reporte no encontrado' });

    const { estado } = req.body;
    if (!ESTADOS_REPORTE.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${ESTADOS_REPORTE.join(', ')}` });
    }

    const reporte = await prisma.reporteOperador.update({
      where: { id },
      data: {
        estado,
        revisadoPorId: estado === 'ABIERTO' ? null : req.usuario.id,
        revisadoEn: estado === 'ABIERTO' ? null : new Date(),
      },
      include: {
        autor: { select: SELECT_AUTOR },
        revisadoPor: { select: { id: true, nombre: true } },
      },
    });

    await avisar(reporte.autorId, req.usuario.id, `Tu reporte sobre un operador fue marcado como ${estado.toLowerCase()}`);

    return res.json({ reporte });
  } catch (error) {
    console.error('[operadores.resolverReporte]', error);
    return res.status(500).json({ error: 'No se pudo actualizar el reporte' });
  }
};

const eliminarReporte = async (req, res) => {
  try {
    const id = Number(req.params.reporteId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.reporteOperador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Reporte no encontrado' });

    if (!puedeAdministrar(req.usuario) && actual.autorId !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo su autor o la mesa directiva pueden eliminarlo' });
    }

    await prisma.reporteOperador.delete({ where: { id } });
    return res.json({ mensaje: 'Reporte eliminado' });
  } catch (error) {
    console.error('[operadores.eliminarReporte]', error);
    return res.status(500).json({ error: 'No se pudo eliminar el reporte' });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarDisponibilidad,
  eliminar,
  listarCalificaciones,
  calificar,
  eliminarCalificacion,
  listarReportes,
  reportar,
  resolverReporte,
  eliminarReporte,
};
