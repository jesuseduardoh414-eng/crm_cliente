// Punto de entrada del servidor Express
const express = require('express');
const cors    = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const authRoutes                        = require('./routes/auth.routes');
const proyectosRoutes                   = require('./routes/proyectos.routes');
const { routerProyecto, routerTarea }   = require('./routes/tareas.routes');
const usuariosRoutes                    = require('./routes/usuarios.routes');
const notificacionesRoutes              = require('./routes/notificaciones.routes');
const statsRoutes                       = require('./routes/stats.routes');
const agendaRoutes                      = require('./routes/agenda.routes');
const maquinasRoutes                    = require('./routes/maquinas.routes');
const operadoresRoutes                  = require('./routes/operadores.routes');
const publicacionesRoutes               = require('./routes/publicaciones.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// Confiar en el proxy de Render para que express-rate-limit funcione bien
app.set('trust proxy', 1);

// Middlewares globales
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      upgradeInsecureRequests: [],
    },
  },
})); // Seguridad de headers
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json()); // Parsear cuerpo JSON de las peticiones
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    // Permite que el frontend en otro origen (ej. Vite en localhost:5173) renderice imagenes subidas.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// Rutas
app.use('/api/auth',                        authRoutes);
app.use('/api/proyectos',                   proyectosRoutes);
app.use('/api/proyectos/:id/tareas',        routerProyecto); // GET y POST de tareas
app.use('/api/tareas',                      routerTarea);    // PUT, DELETE, PATCH de tareas
app.use('/api/usuarios',                    usuariosRoutes);
app.use('/api/notificaciones',              notificacionesRoutes);
app.use('/api/stats',                       statsRoutes);
app.use('/api/agenda',                      agendaRoutes);
app.use('/api/maquinas',                    maquinasRoutes);
app.use('/api/operadores',                  operadoresRoutes);
app.use('/api/publicaciones',               publicacionesRoutes);

// Ruta de salud para verificar que el servidor está corriendo
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mensaje: 'Servidor FEMIC funcionando' });
});

app.use((err, _req, res, _next) => {
  if (!err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el tamano maximo de 5 MB' });
    }
    return res.status(400).json({ error: err.message || 'Error al subir el archivo' });
  }

  return res.status(err.statusCode || 400).json({
    error: err.message || 'Error interno del servidor',
  });
});

// Inicio del servidor.
//
// Solo Vercel se salta el listen: es serverless e importa la app, no la
// arranca. Cualquier otro entorno (local, Render, Railway, un contenedor)
// necesita escuchar de verdad.
//
// Antes la condicion era NODE_ENV !== 'production', que confundia "produccion"
// con "serverless": en Render, que pone NODE_ENV=production por defecto, el
// proceso arrancaba sin escuchar y moria en el health check.
const esServerless = Boolean(process.env.VERCEL);

if (!esServerless) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor FEMIC corriendo en el puerto ${PORT}`);
  });
}

// Exportar para Vercel
module.exports = app;
