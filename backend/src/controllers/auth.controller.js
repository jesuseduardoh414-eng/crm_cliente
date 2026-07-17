const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const prisma  = require('../lib/prisma');
const crypto  = require('crypto');
const { validarPassword } = require('../utils/security.utils');
const { sendResetEmail, sendVerificationEmail } = require('../services/email.service');
const { enviarInvitacion } = require('../services/correo');
const { buildScopeProyectoVisible, puedeGestionarArea, administraUnArea, esRolValido, normalizarRol, ROLES } = require('../utils/permissions.utils');

const usuarioAuthSelect = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  puesto: true,
  biografia: true,
  fotoPerfilUrl: true,
  area: true,
  rol: true,
  creadoEn: true,
};

const usuarioAuthSelectBasico = {
  id: true,
  nombre: true,
  email: true,
  area: true,
  rol: true,
  creadoEn: true,
};

const completarUsuarioAuth = (usuario) => ({
  ...usuario,
  telefono: usuario.telefono ?? null,
  puesto: usuario.puesto ?? null,
  biografia: usuario.biografia ?? null,
  fotoPerfilUrl: usuario.fotoPerfilUrl ?? null,
});

const obtenerUsuarioAuthSeguro = async (usuarioId) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: usuarioAuthSelect,
    });
    return usuario ? completarUsuarioAuth(usuario) : null;
  } catch (_error) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: usuarioAuthSelectBasico,
    });
    return usuario ? completarUsuarioAuth(usuario) : null;
  }
};

// POST /api/auth/register - DESHABILITADO (Solo por invitación)
const register = async (req, res) => {
  return res.status(403).json({ error: 'El registro público está deshabilitado. Solicita una invitación al administrador.' });
};

// €€ GET /api/auth/verify/:token €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const verifyAccount = async (req, res) => {
  const { token } = req.params;

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { verificationToken: token }
    });

    if (!usuario) {
      // Verificar si ya está verificado (el token ya se borró)
      // En este caso, el token no existe, pero podríamos intentar buscar por algo más? 
      // No, si el token no existe es inválido. Pero si el usuario ya está verificado,
      // el frontend podría haber mostrado el error antes.
      return res.status(400).json({ error: 'Token de verificación inválido o ya utilizado' });
    }

    // Verificar expiración
    if (usuario.verificationTokenExpires && usuario.verificationTokenExpires < new Date()) {
      return res.status(400).json({ error: 'El enlace de verificación ha expirado (duración: 15 min)' });
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        verificado: true,
        verificationToken: null
      }
    });

    return res.json({ mensaje: 'Cuenta verificada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('[verifyAccount]', error);
    return res.status(500).json({ error: 'Error al verificar cuenta' });
  }
};

// €€ POST /api/auth/login €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
    
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas ' });
    }

    // VERIFICAR SI ESTÁ ACTIVO
    if (usuario.estado && usuario.estado !== 'activo') {
      return res.status(403).json({ error: 'Tu cuenta no está activa, contacta al administrador' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre, area: usuario.area, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        puesto: usuario.puesto,
        biografia: usuario.biografia,
        fotoPerfilUrl: usuario.fotoPerfilUrl,
        area: usuario.area,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('[login]', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ POST /api/auth/forgot-password €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email es requerido' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
    
    if (!usuario) {
      return res.json({ mensaje: 'Si el correo está registrado, recibirás un enlace de recuperación' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetToken: tokenHash,
        resetTokenExpires: new Date(Date.now() + 3600000)
      }
    });

    await sendResetEmail(usuario.email, token);

    return res.json({ mensaje: 'Si el correo está registrado, recibirás un enlace de recuperación' });
  } catch (error) {
    console.error('[forgotPassword Error]:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message,
      code: error.code
    });
  }
};

// €€ POST /api/auth/reset-password/:token €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: 'Nueva contraseña es requerida' });

  const validation = validarPassword(password);
  if (!validation.valido) {
    return res.status(400).json({ error: 'Contraseña no segura', detalles: validation.errores });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const usuario = await prisma.usuario.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: { gt: new Date() }
      }
    });

    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    });

    return res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('[resetPassword]', error);
    return res.status(500).json({ error: 'Error al resetear contraseña' });
  }
};

const me = async (req, res) => {
  try {
    const usuario = await obtenerUsuarioAuthSeguro(req.usuario.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ usuario });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// €€ INVITACIONES €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€

const invitar = async (req, res) => {
  const { nombre, email, area, rol } = req.body;

  if (!nombre || !email || !area || !rol) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  // Sin esto se podia invitar con cualquier rol inventado y el usuario acababa
  // siendo MIEMBRO sin que nadie se enterara.
  if (!esRolValido(rol)) {
    return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${ROLES.join(', ')}` });
  }

  try {
    const usuarioExistente = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (usuarioExistente) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    if (administraUnArea(req.usuario) && !puedeGestionarArea(req.usuario, area)) {
      return res.status(403).json({ error: 'Solo puedes invitar usuarios de tu propia área' });
    }

    const emailNormalizado = email.toLowerCase().trim();
    const invitacionesExistentes = await prisma.invitacion.findMany({
      where: { email: emailNormalizado, estado: { not: 'aceptada' } },
      orderBy: { creadoEn: 'desc' }
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

    if (invitacionesExistentes.length > 0) {
      const [invitacionActual, ...duplicadas] = invitacionesExistentes;

      await prisma.invitacion.update({
        where: { id: invitacionActual.id },
        data: {
          nombre: nombre.trim(),
          email: emailNormalizado,
          area,
          rol: rol.toLowerCase(),
          token,
          expiraEn,
          estado: 'pendiente',
          creadoPor: req.usuario.id
        }
      });

      if (duplicadas.length > 0) {
        await prisma.invitacion.deleteMany({
          where: { id: { in: duplicadas.map((inv) => inv.id) } }
        });
      }
    } else {
      await prisma.invitacion.create({
        data: {
          nombre: nombre.trim(),
          email: emailNormalizado,
          area,
          rol: rol.toLowerCase(),
          token,
          expiraEn,
          creadoPor: req.usuario.id
        }
      });
    }

    await enviarInvitacion({ nombre, email, token });

    return res.json({ mensaje: `Invitación enviada a ${email}` });
  } catch (error) {
    console.error('[invitar]', error);
    return res.status(500).json({ error: 'Error al enviar invitación' });
  }
};

const verificarInvitacion = async (req, res) => {
  const { token } = req.params;

  try {
    const invitacion = await prisma.invitacion.findUnique({ where: { token } });

    if (!invitacion) {
      return res.status(404).json({ error: 'Invitación no válida' });
    }

    if (invitacion.estado === 'aceptada') {
      return res.status(409).json({ error: 'Invitación ya utilizada' });
    }

    if (invitacion.expiraEn < new Date() || invitacion.estado === 'expirada') {
      return res.status(410).json({ error: 'Invitación expirada' });
    }

    return res.json({
      nombre: invitacion.nombre,
      email: invitacion.email,
      area: invitacion.area
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar invitación' });
  }
};

const aceptarInvitacion = async (req, res) => {
  const { token } = req.params;
  const { password, confirmar_password } = req.body;

  if (!password || !confirmar_password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }

  if (password !== confirmar_password) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const invitacion = await prisma.invitacion.findUnique({ where: { token } });

    if (!invitacion || invitacion.estado !== 'pendiente' || invitacion.expiraEn < new Date()) {
      return res.status(400).json({ error: 'Invitación inválida o expirada' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Crear el usuario
    const rolFinal = normalizarRol(invitacion.rol);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre: invitacion.nombre,
        email: invitacion.email,
        password: passwordHash,
        area: invitacion.area,
        rol: rolFinal,
        estado: 'activo',
        verificado: true
      }
    });

    // El catalogo de operadores ya no depende de las cuentas: son fichas que
    // cualquier miembro da de alta, asi que aceptar una invitacion no crea
    // ninguna. El rol solo dice que puede hacer dentro del panel.

    // Marcar invitación como aceptada
    await prisma.invitacion.update({
      where: { id: invitacion.id },
      data: { estado: 'aceptada' }
    });

    // Generar JWT
    const jwtToken = jwt.sign(
      { id: nuevoUsuario.id, email: nuevoUsuario.email, nombre: nuevoUsuario.nombre, area: nuevoUsuario.area, rol: nuevoUsuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      mensaje: 'Cuenta activada correctamente',
      token: jwtToken,
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        telefono: nuevoUsuario.telefono,
        puesto: nuevoUsuario.puesto,
        biografia: nuevoUsuario.biografia,
        fotoPerfilUrl: nuevoUsuario.fotoPerfilUrl,
        area: nuevoUsuario.area,
        rol: nuevoUsuario.rol
      }
    });
  } catch (error) {
    console.error('[aceptarInvitacion]', error);
    return res.status(500).json({ error: 'Error al aceptar invitación' });
  }
};

const reenviarInvitacion = async (req, res) => {
  const { email } = req.body;

  try {
    const invitacion = await prisma.invitacion.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        estado: { not: 'aceptada' },
        ...(administraUnArea(req.usuario) ? { area: req.usuario.area } : {})
      }
    });

    if (!invitacion) {
      return res.status(404).json({ error: 'No se encontró una invitación pendiente para este email' });
    }

    const nuevoToken = crypto.randomBytes(32).toString('hex');
    const nuevaExpiracion = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.invitacion.update({
      where: { id: invitacion.id },
      data: {
        token: nuevoToken,
        expiraEn: nuevaExpiracion,
        estado: 'pendiente'
      }
    });

    await enviarInvitacion({ nombre: invitacion.nombre, email: invitacion.email, token: nuevoToken });

    return res.json({ mensaje: 'Invitación reenviada correctamente' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al reenviar invitación' });
  }
};

const listarInvitaciones = async (req, res) => {
  try {
    const invitaciones = await prisma.invitacion.findMany({
      where: administraUnArea(req.usuario) ? { area: req.usuario.area } : undefined,
      orderBy: { creadoEn: 'desc' },
      include: { creador: { select: { nombre: true } } }
    });
    return res.json(invitaciones);
  } catch (error) {
    return res.status(500).json({ error: 'Error al listar invitaciones' });
  }
};

const eliminarInvitacion = async (req, res) => {
  const { id } = req.params;

  try {
    const invitacion = await prisma.invitacion.findUnique({ where: { id } });

    if (!invitacion) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    if (administraUnArea(req.usuario) && !puedeGestionarArea(req.usuario, invitacion.area)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta invitación' });
    }

    if (invitacion.estado === 'aceptada') {
      return res.status(409).json({ error: 'No se puede eliminar una invitación aceptada' });
    }

    await prisma.invitacion.delete({ where: { id } });

    return res.json({ mensaje: 'Invitación eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar invitación' });
  }
};

module.exports = { 
  register, 
  login, 
  me, 
  forgotPassword, 
  resetPassword, 
  verifyAccount,
  invitar,
  verificarInvitacion,
  aceptarInvitacion,
  reenviarInvitacion,
  listarInvitaciones,
  eliminarInvitacion
};

