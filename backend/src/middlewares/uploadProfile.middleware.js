const multer = require('multer');

const uploadProfile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('La foto de perfil debe ser una imagen'));
    }
    return cb(null, true);
  },
});

module.exports = uploadProfile;
