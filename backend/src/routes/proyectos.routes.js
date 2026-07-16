// Rutas de Proyectos — todas protegidas con JWT
const express = require('express');
const { listar, equipo, crear, editar, eliminar, listarPlantillas, guardarComoPlantilla } = require('../controllers/proyectos.controller');
const { listarPorProyecto } = require('../controllers/logs.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin }     = require('../middlewares/roles.middleware');

const router = express.Router();

// Aplicar verificarToken a todas las rutas de proyectos
router.use(verificarToken);

const upload = require('../middlewares/upload.middleware');

const { listar: listarComentarios, crear: crearComentario } = require('../controllers/comentarios.controller');
const { listar: listarAdjuntos, subir: subirAdjunto, eliminar: eliminarAdjunto } = require('../controllers/adjuntos.controller');

router.get('/',              listar);
router.get('/plantillas',    listarPlantillas);
router.post('/',             soloAdmin, upload.array('archivos', 5), crear);
router.put('/:id',           soloAdmin, upload.array('archivos', 5), editar);
router.delete('/:id',        soloAdmin, eliminar);
router.get('/:id/equipo',    equipo); // Equipo asignado al proyecto
router.get('/:id/logs',      listarPorProyecto); // Historial de actividad
router.post('/:id/plantilla', soloAdmin, guardarComoPlantilla);

// Comentarios de Proyecto
router.get('/:id/comentarios',  listarComentarios);
router.post('/:id/comentarios', crearComentario);

// Archivos de Proyecto
router.get('/:id/adjuntos',  listarAdjuntos);
router.post('/:id/adjuntos', upload.fields([{ name: 'archivo', maxCount: 1 }, { name: 'archivos', maxCount: 10 }]), subirAdjunto);
router.delete('/adjuntos/:id', eliminarAdjunto);

module.exports = router;
