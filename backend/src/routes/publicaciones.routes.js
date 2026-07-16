const express = require('express');
const {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
} = require('../controllers/publicaciones.controller');
const {
  listar: listarImagenes,
  subir: subirImagenes,
  eliminar: eliminarImagen,
  reordenar: reordenarImagenes,
} = require('../controllers/imagenes.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

const router = express.Router();

router.use(verificarToken);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);

// Imagenes de la publicacion
router.get('/:id/imagenes', listarImagenes);
router.post('/:id/imagenes', upload.array('imagenes', 8), subirImagenes);
router.put('/:id/imagenes/orden', reordenarImagenes);
router.delete('/imagenes/:imagenId', eliminarImagen);

module.exports = router;
