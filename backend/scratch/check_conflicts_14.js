const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 14; 
  console.log('--- Buscando eventos para Jesus Eduardo (ID 14) ---');
  
  const eventos = await prisma.evento.findMany({
    where: {
      OR: [
        { usuarioId: userId },
        { invitados: { some: { usuarioId: userId } } }
      ]
    }
  });

  console.log(JSON.stringify(eventos, null, 2));
  await prisma.$disconnect();
}

check();
