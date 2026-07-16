const express = require('express');
const {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarDisponibilidad,
  eliminar,
  tipos,
} = require('../controllers/maquinas.controller');
const {
  listar: listarImagenes,
  subir: subirImagenes,
  eliminar: eliminarImagen,
  reordenar: reordenarImagenes,
} = require('../controllers/imagenes.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

const router = express.Router();

// Todo el catalogo exige sesion: es un panel interno, no hay vista publica.
// El permiso de escritura no se resuelve con un middleware de rol porque
// depende del propietario de cada maquina; va dentro del controlador.
router.use(verificarToken);

router.get('/tipos', tipos); // antes de /:id, o "tipos" se leeria como un id
router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.patch('/:id/disponibilidad', cambiarDisponibilidad);
router.delete('/:id', eliminar);

// Galeria de la maquina
router.get('/:id/imagenes', listarImagenes);
router.post('/:id/imagenes', upload.array('imagenes', 8), subirImagenes);
router.put('/:id/imagenes/orden', reordenarImagenes);
router.delete('/imagenes/:imagenId', eliminarImagen);

module.exports = router;
