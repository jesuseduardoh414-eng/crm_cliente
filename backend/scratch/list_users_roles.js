const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
  const users = await prisma.usuario.findMany({
    select: { id: true, nombre: true, rol: true }
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

list();
