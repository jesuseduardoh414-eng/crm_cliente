/**
 * Middleware de subida exclusivo para importación de tareas
 * Tipos permitidos: .json, .xlsx, .xls
 * Tamaño máximo: 5MB
 */

const multer = require('multer');
const path   = require('path');

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  const extOk  = ['.json', '.xlsx', '.xls'].includes(ext);
  const mimeOk = [
    'application/json',
    'text/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ].includes(mime);

  if (extOk || mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos .json, .xlsx o .xls'), false);
  }
};

const uploadImport = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

module.exports = uploadImport;
