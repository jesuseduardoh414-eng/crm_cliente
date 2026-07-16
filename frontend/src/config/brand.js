// Identidad de la marca.
//
// PENDIENTE: BRAND_NAME y BRAND_SHORT son provisionales — falta el nombre real
// de la empresa. Este archivo es el UNICO sitio donde vive: el sidebar, el
// login, la pagina de invitacion y el <title> lo leen de aqui, asi que cambiar
// el nombre es editar estas dos lineas y nada mas.
//
// El remitente de los correos NO pasa por aqui (el backend no importa del
// frontend): vive en la variable de entorno EMAIL_FROM, con un fallback en
// backend/src/services/correo.js.

export const BRAND_NAME = 'Ferretería';

// Version corta para el sidebar colapsado, donde solo caben 1-2 caracteres.
export const BRAND_SHORT = 'F';
