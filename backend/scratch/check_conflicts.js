const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 2; // Basado en tu nombre en la captura (Jesus Eduardo)
  console.log('--- Buscando eventos para el usuario ID:', userId, '---');
  
  const eventos = await prisma.evento.findMany({
    where: {
      OR: [
        { usuarioId: userId },
        { invitados: { some: { usuarioId: userId } } }
      ]
    },
    select: {
      id: true,
      titulo: true,
      fechaInicio: true,
      fechaFin: true,
      esRecurrente: true,
      patronRecurrencia: true
    }
  });

  console.log('Encontrados:', eventos.length, 'eventos');
  eventos.forEach(e => {
    console.log(`- [${e.id}] ${e.titulo}: ${e.fechaInicio} -> ${e.fechaFin} (Recurrente: ${e.esRecurrente})`);
    if (e.patronRecurrencia) console.log('  Patrón:', e.patronRecurrencia);
  });
  
  await prisma.$disconnect();
}

check();
