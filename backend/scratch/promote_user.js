const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promote() {
  await prisma.usuario.update({
    where: { id: 14 },
    data: { rol: 'MESA_DIRECTIVA' }
  });
  console.log('✅ Jesus Eduardo (ID 14) ha sido ascendido a MESA_DIRECTIVA exitosamente.');
  await prisma.$disconnect();
}

promote();
