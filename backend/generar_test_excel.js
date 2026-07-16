const XLSX = require('xlsx');
const path = require('path');

// Columnas esperadas por el importador.utils.js:
// ['titulo', 'descripcion', 'estado', 'prioridad', 'fechaInicio', 'venceEn', 'asignadoEmail']

const datos = [
  {
    titulo: "Implementar autenticación biométrica",
    descripcion: "Añadir soporte para FaceID y Huella dactilar en la app móvil",
    estado: "PENDIENTE",
    prioridad: "ALTAs",
    fechaInicio: "2026-06-01",
    venceEn: "2026-06-15",
    asignadoEmail: "admin@test.com"
  },
  {
    titulo: "Refactorizar motor de búsqueda",
    descripcion: "Optimizar consultas SQL para reducir latencia en un 40%",
    estado: "EN_PROGRESO",
    prioridad: "MEDIA",
    fechaInicio: "2026-05-12",
    venceEn: "2026-05-20",
    asignadoEmail: "miembro@test.com"
  },
  {
    titulo: "Actualizar documentación API",
    descripcion: "Documentar los nuevos endpoints de facturación electrónica",
    estado: "HECHO",
    prioridad: "BAJA",
    fechaInicio: "2026-05-01",
    venceEn: "2026-05-05",
    asignadoEmail: ""
  },
  {
    titulo: "Corrección de bug en login",
    descripcion: "El token expira prematuramente en Safari",
    estado: "PENDIENTE",
    prioridad: "ALTA",
    fechaInicio: "2026-05-13",
    venceEn: "2026-05-14",
    asignadoEmail: "admin@test.com"
  }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(datos);
XLSX.utils.book_append_sheet(wb, ws, "Tareas");

const filePath = path.join(__dirname, 'plantilla_tareas_test.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`✅ Archivo generado exitosamente en: ${filePath}`);
