const multer = require('multer');

// En Vercel (serverless) el sistema de archivos es de solo lectura, asi que
// guardamos el archivo en memoria y luego lo subimos a Vercel Blob desde el controlador.
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite de 10MB
  }
});

module.exports = upload;
