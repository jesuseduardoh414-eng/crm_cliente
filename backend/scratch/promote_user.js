const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promote() {
  await prisma.usuario.update({
    where: { id: 14 },
    data: { rol: 'ADMIN' }
  });
  console.log('✅ Jesus Eduardo (ID 14) ha sido ascendido a ADMIN exitosamente.');
  await prisma.$disconnect();
}

promote();
