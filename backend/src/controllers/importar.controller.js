/**
 * Controlador de Importación Masiva de Tareas
 * 
 * POST /api/proyectos/:proyectoId/tareas/importar
 * GET  /api/tareas/plantilla/json
 * GET  /api/tareas/plantilla/excel
 */

const path = require('path');
const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const { registrarActividad } = require('../utils/logger');
const { serializeTasksForExport } = require('../utils/plantillas.utils');
const { puedeAdministrar, puedeAdministrarProyecto } = require('../utils/permissions.utils');
const {
  construirVistaPrevia,
  parseRowsFromFile,
  procesarFilas,
  procesarJSON,
  procesarExcel,
  generarPlantillaJSON,
  generarPlantillaExcel,
} = require('../utils/importador.utils');

const toFileSlug = (value) => String(value || 'proyecto')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toLowerCase() || 'proyecto';

const verificarAccesoProyecto = async (proyectoId, usuario) => {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      creador: { select: { id: true } },
      miembros: { select: { id: true } },
    },
  });

  if (!proyecto) return { error: 'Proyecto no encontrado', status: 404 };
  if (puedeAdministrar(usuario)) {
    if (!puedeAdministrarProyecto(usuario, proyecto)) {
      return { error: 'No tienes permiso para acceder a este proyecto', status: 403 };
    }
    return { proyecto };
  }

  const esMiembro = proyecto.miembros.some(m => m.id === usuario.id);
  const esCreador = proyecto.creador?.id === usuario.id;
  if (!esMiembro && !esCreador) {
    return { error: 'No tienes permiso para acceder a este proyecto', status: 403 };
  }

  return { proyecto };
};

const resolverAsignadoPorDefecto = (modoAsignacion, proyecto, usuario, asignadoIdRaw) => {
  if (modoAsignacion === 'yo') return usuario.id;

  if (modoAsignacion === 'miembro') {
    const miembroId = parseInt(asignadoIdRaw, 10);
    if (Number.isNaN(miembroId)) {
      throw new Error('El miembro seleccionado no es valido');
    }
    const esMiembro = proyecto.miembros.some((m) => m.id === miembroId);
    if (!esMiembro) {
      throw new Error('El miembro seleccionado no pertenece a este proyecto');
    }
    return miembroId;
  }

  return null;
};

const obtenerProyectoImportacion = async (proyectoId) => {
  return prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: { miembros: { select: { id: true, email: true, nombre: true } } },
  });
};

//  POST /api/proyectos/:proyectoId/tareas/importar 
const importar = async (req, res) => {
  // El routerProyecto se monta en /api/proyectos/:id/tareas,
  // por lo que el parámetro del proyecto se llama 'id'
  const proyectoId = parseInt(req.params.id);

  if (isNaN(proyectoId)) {
    return res.status(400).json({ error: 'ID de proyecto inválido' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo. Envía el archivo en el campo "archivo"' });
  }

  const fileBuffer = req.file.buffer;

  try {
    // 1. Verificar que el proyecto existe
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { miembros: { select: { id: true, email: true, nombre: true } } },
    });

    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // 2. Verificar permisos: ADMIN puede siempre, MIEMBRO debe estar en el proyecto
    if (puedeAdministrar(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para importar tareas en este proyecto' });
      }
    } else {
      const esMiembro = proyecto.miembros.some(m => m.id === req.usuario.id);
      if (!esMiembro) {
        return res.status(403).json({ error: 'No tienes permiso para importar tareas en este proyecto' });
      }
    }

    // 3. Determinar el asignado por defecto según el modo elegido en el frontend
    //    modoAsignacion: 'yo' | 'miembro' | 'archivo'
    const modoAsignacion = req.body.modoAsignacion || 'archivo';
    let asignadoPorDefecto = null;

    if (modoAsignacion === 'yo') {
      // Asignar al usuario que hace la subida
      asignadoPorDefecto = req.usuario.id;
    } else if (modoAsignacion === 'miembro') {
      const miembroId = parseInt(req.body.asignadoId);
      if (!isNaN(miembroId)) {
        // Validar que el miembro pertenezca al proyecto
        const esMiembro = proyecto.miembros.some(m => m.id === miembroId);
        if (!esMiembro) {
          return res.status(400).json({ error: 'El miembro seleccionado no pertenece a este proyecto' });
        }
        asignadoPorDefecto = miembroId;
      }
    }
    // modo 'archivo' → asignadoPorDefecto = null (respeta columna del archivo)

    // 4. Detectar tipo de archivo por extensión
    if (asignadoPorDefecto && !proyecto.miembros.some(m => m.id === asignadoPorDefecto)) {
      return res.status(400).json({ error: 'Solo puedes asignar tareas a miembros de este proyecto' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let resultado;

    if (ext === '.json') {
      resultado = await procesarJSON(fileBuffer, proyectoId, proyecto.miembros, registrarActividad, req.usuario.id, asignadoPorDefecto);
    } else if (ext === '.xlsx' || ext === '.xls') {
      resultado = await procesarExcel(fileBuffer, proyectoId, proyecto.miembros, registrarActividad, req.usuario.id, asignadoPorDefecto);
    } else {
      return res.status(400).json({ error: 'Tipo de archivo no soportado. Usa .json, .xlsx o .xls' });
    }

    // 5. Respuesta
    return res.status(200).json({
      creadas: resultado.creadas,
      errores: resultado.errores,
      tareas: resultado.tareas || [],
    });

  } catch (error) {
    console.error('[importar tareas]', error);
    return res.status(400).json({ error: error.message });
  }
};

const vistaPreviaImportacion = async (req, res) => {
  const proyectoId = parseInt(req.params.id);

  if (isNaN(proyectoId)) {
    return res.status(400).json({ error: 'ID de proyecto inválido' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo. Envía el archivo en el campo "archivo"' });
  }

  try {
    const proyecto = await obtenerProyectoImportacion(proyectoId);
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    if (puedeAdministrar(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para importar tareas en este proyecto' });
      }
    } else {
      const esMiembro = proyecto.miembros.some((m) => m.id === req.usuario.id);
      if (!esMiembro) {
        return res.status(403).json({ error: 'No tienes permiso para importar tareas en este proyecto' });
      }
    }

    const modoAsignacion = req.body.modoAsignacion || 'archivo';
    const asignadoPorDefecto = resolverAsignadoPorDefecto(modoAsignacion, proyecto, req.usuario, req.body.asignadoId);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filas = parseRowsFromFile(req.file.buffer, ext);
    const preview = construirVistaPrevia(filas, proyecto.miembros, asignadoPorDefecto);

    return res.status(200).json({
      archivo: req.file.originalname,
      modoAsignacion,
      ...preview,
    });
  } catch (error) {
    console.error('[preview importar tareas]', error);
    return res.status(400).json({ error: error.message });
  }
};

const confirmarImportacion = async (req, res) => {
  const proyectoId = parseInt(req.params.id);

  if (isNaN(proyectoId)) {
    return res.status(400).json({ error: 'ID de proyecto inválido' });
  }

  try {
    const proyecto = await obtenerProyectoImportacion(proyectoId);
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    if (puedeAdministrar(req.usuario)) {
      if (!puedeAdministrarProyecto(req.usuario, proyecto)) {
        return res.status(403).json({ error: 'No tienes permiso para importar tareas en este proyecto' });
      }
    } else {
      const esMiembro = proyecto.miembros.some((m) => m.id === req.usuario.id);
      if (!esMiembro) {
        return res.status(403).json({ error: 'No tienes permiso para importar tareas en este proyecto' });
      }
    }

    const modoAsignacion = req.body.modoAsignacion || 'archivo';
    const asignadoPorDefecto = resolverAsignadoPorDefecto(modoAsignacion, proyecto, req.usuario, req.body.asignadoId);
    const filas = Array.isArray(req.body.filas) ? req.body.filas : [];

    if (filas.length === 0) {
      return res.status(400).json({ error: 'No hay filas para importar' });
    }

    const resultado = await procesarFilas(
      filas,
      proyectoId,
      proyecto.miembros,
      registrarActividad,
      req.usuario.id,
      asignadoPorDefecto
    );

    return res.status(200).json(resultado);
  } catch (error) {
    console.error('[confirmar importar tareas]', error);
    return res.status(400).json({ error: error.message });
  }
};

//  GET /api/tareas/plantilla/json 
const plantillaJSON = (_req, res) => {
  const datos = generarPlantillaJSON();
  const json  = JSON.stringify(datos, null, 2);

  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_tareas.json"');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(json);
};

//  GET /api/tareas/plantilla/excel 
const plantillaExcel = (_req, res) => {
  const buffer = generarPlantillaExcel();

  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_tareas.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};

const exportarJSON = async (req, res) => {
  const proyectoId = parseInt(req.params.id);
  if (isNaN(proyectoId)) {
    return res.status(400).json({ error: 'ID de proyecto inválido' });
  }

  try {
    const acceso = await verificarAccesoProyecto(proyectoId, req.usuario);
    if (acceso.error) return res.status(acceso.status).json({ error: acceso.error });

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        area: true,
        fechaInicio: true,
        fechaFin: true,
        tareas: {
          include: {
            asignado: { select: { id: true, nombre: true, email: true, area: true } },
          },
        },
      },
    });

    const tareas = serializeTasksForExport({ proyecto, tareas: proyecto.tareas });
    const payload = {
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion,
        estado: proyecto.estado,
        area: proyecto.area,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
      },
      tareas,
    };

    const fileSlug = toFileSlug(proyecto.nombre);
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}_tareas.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('[tareas.exportarJSON]', error);
    return res.status(500).json({ error: 'Error al exportar tareas' });
  }
};

const exportarExcel = async (req, res) => {
  const proyectoId = parseInt(req.params.id);
  if (isNaN(proyectoId)) {
    return res.status(400).json({ error: 'ID de proyecto inválido' });
  }

  try {
    const acceso = await verificarAccesoProyecto(proyectoId, req.usuario);
    if (acceso.error) return res.status(acceso.status).json({ error: acceso.error });

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
        nombre: true,
        tareas: {
          include: {
            asignado: { select: { id: true, nombre: true, email: true, area: true } },
          },
        },
      },
    });

    const tareas = serializeTasksForExport({ proyecto, tareas: proyecto.tareas });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(tareas);
    XLSX.utils.book_append_sheet(wb, ws, 'Tareas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const fileSlug = toFileSlug(proyecto.nombre);
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}_tareas.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('[tareas.exportarExcel]', error);
    return res.status(500).json({ error: 'Error al exportar tareas' });
  }
};

module.exports = { importar, vistaPreviaImportacion, confirmarImportacion, plantillaJSON, plantillaExcel, exportarJSON, exportarExcel };
