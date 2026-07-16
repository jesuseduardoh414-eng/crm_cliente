// Siembra los usuarios iniciales.
//
// Hace falta porque el registro publico esta deshabilitado (solo por
// invitacion) y una base recien creada no tiene ningun admin que pueda
// invitar: sin esto no hay forma de entrar al panel.
//
// Es idempotente: se puede correr las veces que haga falta. Si el usuario ya
// existe le actualiza la contraseña y lo reactiva, asi que tambien sirve para
// recuperar el acceso si se pierde la contraseña.
//
// Uso:  node prisma/seed.js
// Las contraseñas se pueden fijar por entorno:
//   SEED_ADMIN_PASSWORD=...  SEED_MIEMBRO_PASSWORD=...

require('dotenv/config');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Coste 12: el mismo que usan register y aceptarInvitacion.
const COSTE_BCRYPT = 12;

const USUARIOS = [
  {
    nombre: 'Administrador',
    email: 'admin@local.test',
    area: 'ADMINISTRACION',
    rol: 'ADMIN',
    puesto: 'Administrador del sistema',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin.2026.local',
  },
  {
    nombre: 'Usuario Panel',
    email: 'usuario@local.test',
    area: 'VENTAS',
    rol: 'MIEMBRO',
    puesto: 'Miembro del equipo',
    password: process.env.SEED_MIEMBRO_PASSWORD || 'Panel.2026.local',
  },
];

async function main() {
  for (const u of USUARIOS) {
    const hash = await bcrypt.hash(u.password, COSTE_BCRYPT);
    const email = u.email.toLowerCase().trim();

    // login() exige estado === 'activo'; el default del schema es 'pendiente',
    // asi que hay que fijarlo o la cuenta responde 403 al entrar.
    const datos = {
      nombre: u.nombre,
      password: hash,
      area: u.area,
      rol: u.rol,
      puesto: u.puesto,
      estado: 'activo',
      verificado: true,
    };

    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: datos,
      create: { ...datos, email },
    });

    console.log(`  ${usuario.rol.padEnd(7)} ${usuario.email.padEnd(20)} (id ${usuario.id})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\nSeed completado.');
  })
  .catch(async (e) => {
    console.error('Seed fallido:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
