const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@test.com'; // Puedes cambiarlo si prefieres usar otro
  const password = 'Admin123*'; // Esta será la nueva contraseña
  const hashedPassword = await bcrypt.hash(password, 12);

  console.log(`Intentando crear/actualizar usuario: ${email}`);

  try {
    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        rol: 'MESA_DIRECTIVA',
        estado: 'activo',
        verificado: true
      },
      create: {
        nombre: 'Administrador',
        email,
        password: hashedPassword,
        rol: 'MESA_DIRECTIVA',
        area: 'ADMINISTRACION',
        estado: 'activo',
        verificado: true
      }
    });

    console.log('✅ Usuario administrador listo.');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
