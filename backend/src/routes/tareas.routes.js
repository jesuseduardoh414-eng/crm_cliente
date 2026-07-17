// Rutas de Tareas con control de roles
// DELETE y operaciones destructivas requieren rol ADMIN

const express = require('express');
const { listar, listarPanel, crear, editar, eliminar, actualizarEstado } = require('../controllers/tareas.controller');
const { importar, vistaPreviaImportacion, confirmarImportacion, plantillaJSON, plantillaExcel, exportarJSON, exportarExcel } = require('../controllers/importar.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin }      = require('../middlewares/roles.middleware');
const { listar: listarComentarios, crear: crearComentario, eliminar: eliminarComentario } = require('../controllers/comentarios.controller');
const { listar: listarAdjuntos, subir: subirAdjunto, eliminar: eliminarAdjunto, descargar: descargarAdjunto, ver: verAdjunto } = require('../controllers/adjuntos.controller');
const upload = require('../middlewares/upload.middleware');
const uploadImport = require('../middlewares/uploadImport.middleware');

const routerProyecto = express.Router({ mergeParams: true });
const routerTarea    = express.Router();

routerProyecto.use(verificarToken);
routerTarea.use(verificarToken);

//  Plantillas descargables
routerTarea.get('/plantilla/json',  plantillaJSON);
routerTarea.get('/plantilla/excel', plantillaExcel);

// Tareas del panel de noticias (las que no son de ninguna obra).
// Va antes que /:id, o Express tomaria "panel" por un id.
routerTarea.get('/panel', listarPanel);

// Listar y crear tareas (cualquier usuario autenticado)
routerProyecto.get('/exportar/json', exportarJSON);
routerProyecto.get('/exportar/excel', exportarExcel);
routerProyecto.get('/',  listar);
routerProyecto.post('/', upload.array('archivos', 5), crear);

//  Importación masiva 
routerProyecto.post('/importar/preview', uploadImport.single('archivo'), vistaPreviaImportacion);
routerProyecto.post('/importar/confirmar', confirmarImportacion);
routerProyecto.post('/importar', uploadImport.single('archivo'), importar);

// Editar y cambiar estado (cualquier usuario autenticado)
routerTarea.put('/:id',          editar);
routerTarea.patch('/:id/estado', actualizarEstado);

// Eliminar tarea (ADMIN o Miembro del proyecto)
routerTarea.delete('/:id', eliminar);

// Comentarios de una tarea
routerTarea.get('/:id/comentarios', listarComentarios);
routerTarea.post('/:id/comentarios', crearComentario);
routerTarea.delete('/comentarios/:id', eliminarComentario);

// Adjuntos de una tarea
routerTarea.get('/:id/adjuntos',         listarAdjuntos);
routerTarea.post('/:id/adjuntos',        upload.fields([{ name: 'archivo', maxCount: 1 }, { name: 'archivos', maxCount: 10 }]), subirAdjunto);
routerTarea.delete('/adjuntos/:id',      eliminarAdjunto);
routerTarea.get('/adjuntos/descargar/:filename', descargarAdjunto);
routerTarea.get('/adjuntos/ver/:filename', verAdjunto);

module.exports = { routerProyecto, routerTarea };
