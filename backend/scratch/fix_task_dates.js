const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('Iniciando sincronización de fechas para tareas completadas...');
  const tasks = await prisma.tarea.findMany({
    where: {
      estado: 'HECHO',
      NOT: { completadoEn: null }
    }
  });

  console.log(`Se encontraron ${tasks.length} tareas completadas.`);

  for (const t of tasks) {
    // Ajustar completadoEn a la zona horaria del usuario (-6h) para determinar el día real
    const comp = new Date(t.completadoEn.getTime() - 6 * 60 * 60 * 1000);
    comp.setUTCHours(12, 0, 0, 0); // Ajustar a mediodía para consistencia

    // Si la fecha de vencimiento es diferente a la fecha en que se completó
    if (t.venceEn && t.venceEn.getTime() !== comp.getTime()) {
      console.log(`Ajustando tarea: "${t.titulo}"`);
      console.log(`  - Anterior venceEn: ${t.venceEn.toISOString()}`);
      console.log(`  - Nuevo venceEn:    ${comp.toISOString()}`);
      
      await prisma.tarea.update({
        where: { id: t.id },
        data: { venceEn: comp }
      });
    }
  }
  console.log('Sincronización terminada.');
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
