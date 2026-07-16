// Controlador de Operadores
//
// Un operador es un Usuario con rol OPERADOR mas su PerfilOperador. La
// disponibilidad la lleva el propio operador; un ADMIN puede corregirla.
// Ver el listado lo puede hacer cualquiera con sesion: de eso trata "dar de
// alta operadores disponibles".

const prisma = require('../lib/prisma');
const { esAdmin } = require('../utils/permissions.utils');

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  area: true,
  rol: true,
  fotoPerfilUrl: true,
};

const INCLUDE_PERFIL = { usuario: { select: SELECT_USUARIO } };

const puedeEditarPerfil = (usuario, perfil) =>
  esAdmin(usuario) || perfil.usuarioId === usuario.id;

const parseTarifa = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = invalido
};

// Listado de operadores. Por defecto muestra solo los disponibles, que es el
// caso de uso real ("quien puede trabajar hoy"); ?todos=true los trae todos.
const listar = async (req, res) => {
  try {
    const { todos, especialidad, zona } = req.query;

    const perfiles = await prisma.perfilOperador.findMany({
      where: {
        ...(todos === 'true' ? {} : { disponible: true }),
        ...(especialidad ? { especialidad: { contains: especialidad, mode: 'insensitive' } } : {}),
        ...(zona ? { zona: { contains: zona, mode: 'insensitive' } } : {}),
      },
      include: INCLUDE_PERFIL,
      orderBy: [{ disponible: 'desc' }, { creadoEn: 'desc' }],
    });

    return res.json({ operadores: perfiles });
  } catch (error) {
    console.error('[operadores.listar]', error);
    return res.status(500).json({ error: 'No se pudieron cargar los operadores' });
  }
};

const obtener = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const perfil = await prisma.perfilOperador.findUnique({ where: { id }, include: INCLUDE_PERFIL });
    if (!perfil) return res.status(404).json({ error: 'Operador no encontrado' });

    return res.json({ operador: perfil });
  } catch (error) {
    console.error('[operadores.obtener]', error);
    return res.status(500).json({ error: 'No se pudo cargar el operador' });
  }
};

// El perfil del operador que tiene la sesion abierta.
const miPerfil = async (req, res) => {
  try {
    const perfil = await prisma.perfilOperador.findUnique({
      where: { usuarioId: req.usuario.id },
      include: INCLUDE_PERFIL,
    });
    if (!perfil) return res.status(404).json({ error: 'No tienes perfil de operador' });
    return res.json({ operador: perfil });
  } catch (error) {
    console.error('[operadores.miPerfil]', error);
    return res.status(500).json({ error: 'No se pudo cargar tu perfil' });
  }
};

// Da de alta el perfil de operador sobre un usuario que ya existe.
// No crea cuentas: el alta de usuarios pasa por invitacion, que es la unica via
// del panel. Aqui solo se le añaden sus datos de operador.
const crear = async (req, res) => {
  try {
    const { usuarioId, especialidad, descripcion, zona, telefonoContacto, tarifaHora, experienciaAnios, disponible } = req.body;

    // Un ADMIN puede dar de alta a cualquiera; el resto, solo a si mismo.
    const objetivoId = usuarioId !== undefined ? Number(usuarioId) : req.usuario.id;
    if (!Number.isInteger(objetivoId)) return res.status(400).json({ error: 'usuarioId inválido' });

    if (objetivoId !== req.usuario.id && !esAdmin(req.usuario)) {
      return res.status(403).json({ error: 'Solo un administrador puede dar de alta a otro operador' });
    }

    if (!especialidad?.trim()) return res.status(400).json({ error: 'La especialidad es requerida' });

    const tarifa = parseTarifa(tarifaHora);
    if (tarifa === undefined) return res.status(400).json({ error: 'La tarifa por hora no es válida' });

    const usuario = await prisma.usuario.findUnique({ where: { id: objetivoId } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const yaExiste = await prisma.perfilOperador.findUnique({ where: { usuarioId: objetivoId } });
    if (yaExiste) return res.status(409).json({ error: 'Ese usuario ya tiene perfil de operador' });

    // El perfil y el rol van juntos: un perfil de operador sobre un usuario que
    // no es OPERADOR dejaria el listado mostrando gente que no lo es.
    const [perfil] = await prisma.$transaction([
      prisma.perfilOperador.create({
        data: {
          usuarioId: objetivoId,
          especialidad: especialidad.trim(),
          descripcion: descripcion?.trim() || null,
          zona: zona?.trim() || null,
          telefonoContacto: telefonoContacto?.trim() || null,
          tarifaHora: tarifa,
          experienciaAnios: experienciaAnios ? Number(experienciaAnios) : null,
          disponible: disponible !== undefined ? Boolean(disponible) : false,
        },
        include: INCLUDE_PERFIL,
      }),
      prisma.usuario.update({ where: { id: objetivoId }, data: { rol: 'OPERADOR' } }),
    ]);

    // Se relee para que el usuario incluido ya traiga el rol actualizado.
    const creado = await prisma.perfilOperador.findUnique({ where: { id: perfil.id }, include: INCLUDE_PERFIL });
    return res.status(201).json({ operador: creado });
  } catch (error) {
    console.error('[operadores.crear]', error);
    return res.status(500).json({ error: 'No se pudo dar de alta el operador' });
  }
};

const actualizar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.perfilOperador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Operador no encontrado' });

    if (!puedeEditarPerfil(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el propio operador o un administrador pueden editar este perfil' });
    }

    const { especialidad, descripcion, zona, telefonoContacto, tarifaHora, experienciaAnios, disponible } = req.body;

    if (especialidad !== undefined && !especialidad.trim()) {
      return res.status(400).json({ error: 'La especialidad no puede quedar vacía' });
    }

    let tarifa;
    if (tarifaHora !== undefined) {
      tarifa = parseTarifa(tarifaHora);
      if (tarifa === undefined) return res.status(400).json({ error: 'La tarifa por hora no es válida' });
    }

    const operador = await prisma.perfilOperador.update({
      where: { id },
      data: {
        ...(especialidad !== undefined ? { especialidad: especialidad.trim() } : {}),
        ...(descripcion !== undefined ? { descripcion: descripcion?.trim() || null } : {}),
        ...(zona !== undefined ? { zona: zona?.trim() || null } : {}),
        ...(telefonoContacto !== undefined ? { telefonoContacto: telefonoContacto?.trim() || null } : {}),
        ...(tarifaHora !== undefined ? { tarifaHora: tarifa } : {}),
        ...(experienciaAnios !== undefined ? { experienciaAnios: experienciaAnios ? Number(experienciaAnios) : null } : {}),
        ...(disponible !== undefined ? { disponible: Boolean(disponible) } : {}),
      },
      include: INCLUDE_PERFIL,
    });

    return res.json({ operador });
  } catch (error) {
    console.error('[operadores.actualizar]', error);
    return res.status(500).json({ error: 'No se pudo actualizar el operador' });
  }
};

// Atajo para lo que un operador hace a diario: marcarse libre u ocupado.
const cambiarDisponibilidad = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.perfilOperador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Operador no encontrado' });

    if (!puedeEditarPerfil(req.usuario, actual)) {
      return res.status(403).json({ error: 'Solo el propio operador o un administrador pueden cambiar la disponibilidad' });
    }

    const { disponible } = req.body;
    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ error: 'disponible debe ser true o false' });
    }

    const operador = await prisma.perfilOperador.update({
      where: { id },
      data: { disponible },
      include: INCLUDE_PERFIL,
    });

    return res.json({ operador });
  } catch (error) {
    console.error('[operadores.cambiarDisponibilidad]', error);
    return res.status(500).json({ error: 'No se pudo cambiar la disponibilidad' });
  }
};

// Quita el perfil y devuelve al usuario a MIEMBRO. No borra la cuenta: dejar de
// ser operador no es dejar de existir.
const eliminar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

    const actual = await prisma.perfilOperador.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Operador no encontrado' });

    if (!esAdmin(req.usuario)) {
      return res.status(403).json({ error: 'Solo un administrador puede dar de baja a un operador' });
    }

    await prisma.$transaction([
      prisma.perfilOperador.delete({ where: { id } }),
      prisma.usuario.update({ where: { id: actual.usuarioId }, data: { rol: 'MIEMBRO' } }),
    ]);

    return res.json({ mensaje: 'Operador dado de baja' });
  } catch (error) {
    console.error('[operadores.eliminar]', error);
    return res.status(500).json({ error: 'No se pudo dar de baja el operador' });
  }
};

// Usuarios a los que aun se les puede dar de alta como operador, para el
// selector del formulario.
const candidatos = async (req, res) => {
  try {
    if (!esAdmin(req.usuario)) return res.status(403).json({ error: 'Solo un administrador' });

    const usuarios = await prisma.usuario.findMany({
      where: { perfilOperador: null, estado: 'activo' },
      select: SELECT_USUARIO,
      orderBy: { nombre: 'asc' },
    });

    return res.json({ candidatos: usuarios });
  } catch (error) {
    console.error('[operadores.candidatos]', error);
    return res.status(500).json({ error: 'No se pudieron cargar los candidatos' });
  }
};

module.exports = { listar, obtener, miPerfil, crear, actualizar, cambiarDisponibilidad, eliminar, candidatos };
