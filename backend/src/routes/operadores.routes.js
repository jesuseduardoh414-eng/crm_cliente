const express = require('express');
const {
  listar,
  obtener,
  miPerfil,
  crear,
  actualizar,
  cambiarDisponibilidad,
  eliminar,
  candidatos,
} = require('../controllers/operadores.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(verificarToken);

// Las rutas con nombre fijo van antes que /:id, o Express las tomaria por ids.
router.get('/mi-perfil', miPerfil);
router.get('/candidatos', candidatos);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.patch('/:id/disponibilidad', cambiarDisponibilidad);
router.delete('/:id', eliminar);

module.exports = router;
