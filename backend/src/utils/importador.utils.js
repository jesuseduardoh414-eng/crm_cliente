const XLSX = require('xlsx');
const prisma = require('../lib/prisma');

const ESTADOS_VALIDOS = ['PENDIENTE', 'EN_PROGRESO', 'HECHO'];
const PRIORIDADES_VALIDAS = ['BAJA', 'MEDIA', 'ALTA'];
const COLUMNAS_EXCEL = ['numeroActividad', 'titulo', 'descripcion', 'estado', 'prioridad', 'fechaInicio', 'venceEn', 'asignadoEmail'];
const IMPORT_TASK_INCLUDE = {
  asignado: {
    select: { id: true, nombre: true, area: true },
  },
  asignados: {
    select: { id: true, nombre: true, area: true },
  },
  creador: {
    select: { id: true, nombre: true, area: true },
  },
};

const normalizarEstado = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';

  const mapa = {
    PENDIENTE: 'PENDIENTE',
    'POR HACER': 'PENDIENTE',
    POR_HACER: 'PENDIENTE',
    EN_PROGRESO: 'EN_PROGRESO',
    'EN PROGRESO': 'EN_PROGRESO',
    'EN-PROGRESO': 'EN_PROGRESO',
    HECHO: 'HECHO',
    COMPLETADO: 'HECHO',
    TERMINADO: 'HECHO',
  };

  return mapa[raw] || raw;
};

const normalizarPrioridad = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';

  const mapa = {
    BAJA: 'BAJA',
    MEDIA: 'MEDIA',
    ALTA: 'ALTA',
    LOW: 'BAJA',
    MEDIUM: 'MEDIA',
    HIGH: 'ALTA',
  };

  return mapa[raw] || raw;
};

const formatDateInput = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const normalizarFilaEditable = (raw = {}) => ({
  numeroActividad: raw.numeroActividad ?? '',
  titulo: raw.titulo ?? '',
  descripcion: raw.descripcion ?? '',
  estado: normalizarEstado(raw.estado),
  prioridad: normalizarPrioridad(raw.prioridad),
  fechaInicio: raw.fechaInicio ?? '',
  venceEn: raw.venceEn ?? '',
  asignadoEmail: raw.asignadoEmail ?? '',
});

const validarFila = (raw) => {
  const fila = normalizarFilaEditable(raw);
  const errores = [];

  if (!fila.titulo || String(fila.titulo).trim() === '') {
    errores.push('falta el campo obligatorio "titulo"');
  }

  if (fila.estado) {
    const estado = normalizarEstado(fila.estado);
    if (!ESTADOS_VALIDOS.includes(estado)) {
      errores.push(`estado "${fila.estado}" no valido (usa: ${ESTADOS_VALIDOS.join(' | ')})`);
    } else {
      fila.estado = estado;
    }
  }

  if (fila.prioridad) {
    const prioridad = normalizarPrioridad(fila.prioridad);
    if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
      errores.push(`prioridad "${fila.prioridad}" no valida (usa: ${PRIORIDADES_VALIDAS.join(' | ')})`);
    } else {
      fila.prioridad = prioridad;
    }
  }

  if (fila.fechaInicio) {
    const fecha = new Date(fila.fechaInicio);
    if (Number.isNaN(fecha.getTime())) {
      errores.push(`fechaInicio "${fila.fechaInicio}" no es una fecha valida (usa formato YYYY-MM-DD)`);
    }
  }

  if (fila.venceEn) {
    const fecha = new Date(fila.venceEn);
    if (Number.isNaN(fecha.getTime())) {
      errores.push(`venceEn "${fila.venceEn}" no es una fecha valida (usa formato YYYY-MM-DD)`);
    }
  }

  if (fila.numeroActividad !== undefined && fila.numeroActividad !== null && String(fila.numeroActividad).trim() !== '') {
    const numero = parseInt(fila.numeroActividad, 10);
    if (Number.isNaN(numero) || numero <= 0) {
      errores.push(`numeroActividad "${fila.numeroActividad}" no es valido (usa un entero mayor a 0)`);
    } else {
      fila.numeroActividad = numero;
    }
  }

  if (errores.length > 0) {
    return { valida: false, tarea: null, razon: errores.join('; '), filaNormalizada: fila };
  }

  return {
    valida: true,
    tarea: {
      titulo: String(fila.titulo).trim(),
      descripcion: fila.descripcion ? String(fila.descripcion).trim() : null,
      numeroActividad: fila.numeroActividad ? parseInt(fila.numeroActividad, 10) : null,
      estado: fila.estado ? String(fila.estado).toUpperCase() : 'PENDIENTE',
      prioridad: fila.prioridad ? String(fila.prioridad).toUpperCase() : 'MEDIA',
      fechaInicio: fila.fechaInicio ? new Date(fila.fechaInicio) : new Date(),
      venceEn: fila.venceEn ? new Date(fila.venceEn) : null,
      asignadoEmail: fila.asignadoEmail ? String(fila.asignadoEmail).trim().toLowerCase() : null,
    },
    razon: null,
    filaNormalizada: fila,
  };
};

const obtenerTextoDesdeFuente = (fileSource) => {
  if (Buffer.isBuffer(fileSource)) {
    return fileSource.toString('utf-8');
  }
  return String(fileSource || '');
};

const parseJSONRows = (fileSource) => {
  let raw;
  try {
    const contenido = obtenerTextoDesdeFuente(fileSource).replace(/^\uFEFF/, '').trim();
    raw = JSON.parse(contenido);
  } catch (error) {
    throw new Error(`El archivo JSON no es valido o esta mal formateado${error?.message ? `: ${error.message}` : ''}`);
  }

  if (!Array.isArray(raw)) {
    if (raw && typeof raw === 'object' && Array.isArray(raw.tareas)) {
      raw = raw.tareas;
    } else {
      throw new Error('El archivo JSON debe contener un array de tareas en la raiz o una propiedad "tareas" con ese array');
    }
  }

  return raw;
};

const parseExcelRows = (fileSource) => {
  let workbook;
  try {
    workbook = Buffer.isBuffer(fileSource)
      ? XLSX.read(fileSource, { type: 'buffer' })
      : XLSX.readFile(fileSource);
  } catch {
    throw new Error('El archivo Excel no se pudo leer. Verifica que sea un .xlsx o .xls valido');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('El archivo Excel esta vacio o solo contiene el encabezado');
  }

  const primeraFila = rows[0];
  if (!('titulo' in primeraFila)) {
    throw new Error(`El archivo Excel no tiene la columna "titulo". Columnas esperadas: ${COLUMNAS_EXCEL.join(', ')}`);
  }

  return rows.filter((row) =>
    COLUMNAS_EXCEL.some((col) => row[col] && String(row[col]).trim() !== '')
  );
};

const parseRowsFromFile = (fileSource, ext) => {
  if (ext === '.json') return parseJSONRows(fileSource);
  if (ext === '.xlsx' || ext === '.xls') return parseExcelRows(fileSource);
  throw new Error('Tipo de archivo no soportado. Usa .json, .xlsx o .xls');
};

const resolverAsignado = (asignadoEmail, miembros, asignadoPorDefecto = null) => {
  if (!asignadoEmail) {
    return {
      asignadoId: asignadoPorDefecto,
      asignadoNombre: miembros.find((m) => m.id === asignadoPorDefecto)?.nombre || '',
      aviso: null,
    };
  }

  const miembro = miembros.find((m) => m.email.toLowerCase() === asignadoEmail);
  if (miembro) {
    return {
      asignadoId: miembro.id,
      asignadoNombre: miembro.nombre,
      aviso: null,
    };
  }

  if (asignadoPorDefecto) {
    return {
      asignadoId: asignadoPorDefecto,
      asignadoNombre: miembros.find((m) => m.id === asignadoPorDefecto)?.nombre || '',
      aviso: `No se encontró el correo "${asignadoEmail}". Se usará la asignación por defecto.`,
    };
  }

  return {
    asignadoId: null,
    asignadoNombre: '',
    aviso: `No se encontró el correo "${asignadoEmail}". La tarea quedará sin asignar.`,
  };
};

const construirVistaPrevia = (filas, miembros, asignadoPorDefecto = null) => {
  const preview = filas.map((fila, index) => {
    const { valida, tarea, razon, filaNormalizada } = validarFila(fila);

    if (!valida) {
      return {
        fila: index + 1,
        ...normalizarFilaEditable(filaNormalizada),
        valida: false,
        errores: razon.split('; ').filter(Boolean),
        avisos: [],
        asignadoNombre: '',
      };
    }

    const asignacion = resolverAsignado(tarea.asignadoEmail, miembros, asignadoPorDefecto);

    return {
      fila: index + 1,
      numeroActividad: tarea.numeroActividad ?? '',
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || '',
      estado: tarea.estado,
      prioridad: tarea.prioridad,
      fechaInicio: formatDateInput(tarea.fechaInicio),
      venceEn: formatDateInput(tarea.venceEn),
      asignadoEmail: tarea.asignadoEmail || '',
      valida: true,
      errores: [],
      avisos: asignacion.aviso ? [asignacion.aviso] : [],
      asignadoNombre: asignacion.asignadoNombre,
    };
  });

  return {
    filas: preview,
    resumen: {
      total: preview.length,
      validas: preview.filter((fila) => fila.valida).length,
      invalidas: preview.filter((fila) => !fila.valida).length,
    },
  };
};

const procesarFilas = async (filas, proyectoId, miembros, registrarActividad, usuarioId, asignadoPorDefecto = null) => {
  const errores = [];
  const tareasACrear = [];

  for (let i = 0; i < filas.length; i += 1) {
    const numeroFila = i + 1;
    const { valida, tarea, razon } = validarFila(filas[i]);

    if (!valida) {
      errores.push({ fila: numeroFila, razon });
      continue;
    }

    const asignacion = resolverAsignado(tarea.asignadoEmail, miembros, asignadoPorDefecto);
    tarea.asignadoId = asignacion.asignadoId;

    delete tarea.asignadoEmail;
    tarea.proyectoId = proyectoId;
    tarea.creadorId = usuarioId;
    tareasACrear.push(tarea);
  }

  let creadas = 0;
  let tareasCreadas = [];
  if (tareasACrear.length > 0) {
    const tareasInsertadas = await prisma.$transaction(
      tareasACrear.map((tarea) => prisma.tarea.create({ data: tarea }))
    );
    creadas = tareasACrear.length;
    const tareasCreadasIds = tareasInsertadas.map((tarea) => tarea.id);

    tareasCreadas = await prisma.tarea.findMany({
      where: { id: { in: tareasCreadasIds } },
      include: IMPORT_TASK_INCLUDE,
    });

    await registrarActividad(
      usuarioId,
      proyectoId,
      'IMPORTAR_TAREAS',
      `Se importaron ${creadas} tarea(s) masivamente al proyecto`
    );
  }

  return { creadas, errores, tareas: tareasCreadas };
};

const procesarJSON = async (fileSource, proyectoId, miembros, registrarActividad, usuarioId, asignadoPorDefecto = null) => {
  const rows = parseJSONRows(fileSource);
  return procesarFilas(rows, proyectoId, miembros, registrarActividad, usuarioId, asignadoPorDefecto);
};

const procesarExcel = async (fileSource, proyectoId, miembros, registrarActividad, usuarioId, asignadoPorDefecto = null) => {
  const rows = parseExcelRows(fileSource);
  return procesarFilas(rows, proyectoId, miembros, registrarActividad, usuarioId, asignadoPorDefecto);
};

const generarPlantillaJSON = () => ([
  {
    numeroActividad: 1,
    titulo: 'Diseno de interfaz de usuario',
    descripcion: 'Crear wireframes y mockups para la nueva pantalla de reportes',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    fechaInicio: '2025-06-01',
    venceEn: '2025-06-15',
    asignadoEmail: 'miembro@empresa.com',
  },
  {
    numeroActividad: 2,
    titulo: 'Integracion con API de pagos',
    descripcion: 'Conectar el modulo de facturacion con el gateway de pago seleccionado',
    estado: 'EN_PROGRESO',
    prioridad: 'ALTA',
    venceEn: '2025-06-30',
    asignadoEmail: '',
  },
  {
    numeroActividad: 3,
    titulo: 'Documentacion tecnica',
    descripcion: 'Escribir la documentacion del modulo de autenticacion',
    estado: 'PENDIENTE',
    prioridad: 'BAJA',
    venceEn: '',
    asignadoEmail: '',
  },
]);

const generarPlantillaExcel = () => {
  const datos = generarPlantillaJSON();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos, { header: COLUMNAS_EXCEL });

  ws['!cols'] = [
    { wch: 16 },
    { wch: 35 },
    { wch: 55 },
    { wch: 15 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Tareas');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  COLUMNAS_EXCEL,
  ESTADOS_VALIDOS,
  PRIORIDADES_VALIDAS,
  construirVistaPrevia,
  generarPlantillaExcel,
  generarPlantillaJSON,
  parseRowsFromFile,
  procesarExcel,
  procesarFilas,
  procesarJSON,
  validarFila,
};
