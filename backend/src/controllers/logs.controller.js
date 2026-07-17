const prisma = require('../lib/prisma');
const { puedeAdministrar, veTodo, puedeAdministrarProyecto } = require('../utils/permissions.utils');

const listarPorProyecto = async (req, res) => {
  const proyectoId = parseInt(req.params.id);
  if (isNaN(proyectoId)) return res.status(400).json({ error: 'ID de proyecto inválido' });

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, area: true }
    });

    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // El historial completo lo ven el consejo y la mesa; el resto, solo lo que
    // toca sus tareas.
    const veTodoElHistorial = veTodo(req.usuario);
    if (puedeAdministrar(req.usuario) && !puedeAdministrarProyecto(req.usuario, proyecto)) {
      return res.status(403).json({ error: 'No tienes permiso para ver el historial de este proyecto' });
    }
    const accionesSoloDeTarea = [
      'CREAR_TAREA',
      'EDITAR_TAREA',
      'ELIMINAR_TAREA',
      'CAMBIO_ESTADO'
    ];

    const logs = await prisma.logActividad.findMany({
      where: {
        proyectoId,
        ...(veTodoElHistorial ? {} : {
          OR: [
            {
              tareaId: null,
              accion: { notIn: accionesSoloDeTarea },
              NOT: { descripcion: { contains: 'tarea' } }
            },
            { tarea: { asignadoId: null } },
            { tarea: { asignadoId: req.usuario.id } },
            { tarea: { creadorId: req.usuario.id } }
          ]
        })
      },
      orderBy: { creadoEn: 'desc' },
      take: 50, // Limitamos a los últimos 50 para rendimiento
      include: {
        usuario: {
          select: { id: true, nombre: true, area: true }
        }
      }
    });

    res.json({ logs });
  } catch (error) {
    console.error('[logs.listarPorProyecto]', error);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
};

module.exports = {
  listarPorProyecto
};
