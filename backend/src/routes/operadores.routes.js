const express = require('express');
const {
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
} = require('../controllers/operadores.controller');
const {
  listar: listarImagenes,
  subir: subirImagenes,
  eliminar: eliminarImagen,
} = require('../controllers/imagenes.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

const router = express.Router();

router.use(verificarToken);

// Las rutas de reportes sueltos van antes que /:id, o Express tomaria
// "reportes" por un id.
router.patch('/reportes/:reporteId', resolverReporte);
router.delete('/reportes/:reporteId', eliminarReporte);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.patch('/:id/disponibilidad', cambiarDisponibilidad);
router.delete('/:id', eliminar);

// Lo que opina el equipo del operador
router.get('/:id/calificaciones', listarCalificaciones);
router.post('/:id/calificaciones', calificar);
router.delete('/:id/calificaciones', eliminarCalificacion);

router.get('/:id/reportes', listarReportes);
router.post('/:id/reportes', reportar);

// Foto de la ficha
router.get('/:id/imagenes', listarImagenes);
router.post('/:id/imagenes', upload.array('imagenes', 4), subirImagenes);
router.delete('/imagenes/:imagenId', eliminarImagen);

module.exports = router;
