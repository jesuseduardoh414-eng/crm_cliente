const rateLimit = require('express-rate-limit');

// Limitador para autenticación (prevención de fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // Limitar cada IP a 50 peticiones por ventana
  message: {
    error: 'Demasiados intentos desde esta IP, por favor intenta de nuevo en 15 minutos'
  },
  standardHeaders: true, // Devuelve info en RateLimit-* headers
  legacyHeaders: false, // Desactiva X-RateLimit-* headers
});

module.exports = { authLimiter };
