// Middleware de autenticación JWT
// Valida el token en el header Authorization antes de dar acceso a rutas protegidas
const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  // El token viene en el header: "Authorization: Bearer <token>"
  let token = null;

  // Intentar obtener del header
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } 
  
  // Si no hay en header, intentar de query params (útil para descargas directas)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado: token no encontrado' });
  }

  try {
    // Verificar y decodificar el token con el secreto
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // Adjuntar datos del usuario a la request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { verificarToken };
