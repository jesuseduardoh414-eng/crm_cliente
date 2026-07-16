// Rutas de la Agenda Personal
const express = require('express');
const router = express.Router();
const agendaController = require('../controllers/agenda.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { listar: listarAdjuntos, subir: subirAdjunto, eliminar: eliminarAdjunto } = require('../controllers/adjuntos.controller');
const upload = require('../middlewares/upload.middleware');

// Todas las rutas de agenda requieren autenticación
router.use(verificarToken);

// Configuración laboral (Debe ir antes de /:id para evitar conflictos)
router.get('/config-laboral', agendaController.getConfigLaboral);
router.put('/config-laboral', agendaController.updateConfigLaboral);
router.get('/google-calendar/status', agendaController.getGoogleCalendarStatus);
router.post('/google-calendar/connect', agendaController.connectGoogleCalendarController);
router.delete('/google-calendar/connect', agendaController.disconnectGoogleCalendarController);

// Endpoints principales
router.get('/',               agendaController.listar);
router.post('/',              agendaController.crear);
router.get('/recordatorios', agendaController.recordatoriosProximos);
router.get('/invitaciones/pendientes', agendaController.invitacionesPendientes);
router.patch('/:id/responder', agendaController.responderInvitacion);
router.get('/disponibilidad', agendaController.consultarDisponibilidad);
router.put('/:id',            agendaController.editar);
router.delete('/:id',         agendaController.eliminar);
router.get('/:id/adjuntos',   listarAdjuntos);
router.post('/:id/adjuntos',  upload.fields([{ name: 'archivo', maxCount: 1 }, { name: 'archivos', maxCount: 10 }]), subirAdjunto);
router.delete('/adjuntos/:id', eliminarAdjunto);

// Días especiales
router.get('/dias-especiales', agendaController.listarDiasEspeciales);
router.post('/dias-especiales', agendaController.crearDiaEspecial);
router.delete('/dias-especiales/:id', agendaController.eliminarDiaEspecial);

module.exports = router;
