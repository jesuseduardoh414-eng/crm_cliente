// Almacenamiento de archivos.
//
// En produccion (Vercel) el disco es de solo lectura, asi que todo va a Vercel
// Blob. Pero eso exige BLOB_READ_WRITE_TOKEN, y sin el la app no arranca ni
// para desarrollo: cualquier subida revienta con 500.
//
// Por eso hay dos backends y se elige solo: si hay token, Blob; si no, disco
// local servido desde /uploads (server.js ya lo expone como estatico). Asi se
// puede trabajar en local sin credenciales, y en produccion basta con definir
// la variable.

const fs = require('fs');
const path = require('path');
const { put, del } = require('@vercel/blob');

const DIR_LOCAL = path.join(__dirname, '../../uploads');

const hayBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

const esServerless = () => Boolean(process.env.VERCEL);

const esUrlAbsoluta = (valor) => /^https?:\/\//i.test(valor || '');

// Aplana el nombre a algo seguro para el sistema de archivos: sin separadores
// de ruta, sin acentos raros y sin espacios.
const nombreSeguro = (nombre) =>
  String(nombre || 'archivo')
    .replace(/[/\\]/g, '-')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-120);

/**
 * Guarda un archivo y devuelve su URL publica.
 * @param {{buffer: Buffer, originalname: string, mimetype: string}} file
 * @param {string} carpeta prefijo logico, p.ej. "maquinas/12"
 */
const guardarArchivo = async (file, carpeta = '') => {
  const base = `${Date.now()}-${nombreSeguro(file.originalname)}`;
  const clave = carpeta ? `${carpeta}/${base}` : base;

  if (hayBlob()) {
    const blob = await put(clave, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    return blob.url;
  }

  // En serverless no hay respaldo posible: el disco es de solo lectura y el
  // mkdirSync de abajo reventaria con un EROFS que no dice nada de la causa
  // real. Mejor fallar aqui diciendo exactamente que falta.
  if (esServerless()) {
    const e = new Error(
      'Falta BLOB_READ_WRITE_TOKEN: en produccion los archivos se guardan en Vercel Blob '
      + 'y sin ese token no hay donde escribirlos.',
    );
    e.statusCode = 500;
    throw e;
  }

  // Fallback local: se replica la carpeta dentro de uploads/ para no acabar con
  // un cajon plano de miles de archivos.
  const destino = path.join(DIR_LOCAL, carpeta);
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, base), file.buffer);

  // Relativa a proposito: el frontend la resuelve contra la URL del backend, y
  // asi no se hornea el host en la base de datos.
  return `/uploads/${clave}`;
};

/**
 * Borra un archivo por su URL. No lanza si ya no existe: lo que importa es que
 * deje de estar referenciado.
 */
const borrarArchivo = async (url) => {
  if (!url) return;

  if (esUrlAbsoluta(url)) {
    if (!hayBlob()) return; // subido con otra config; no hay con que borrarlo
    try {
      await del(url);
    } catch (e) {
      console.warn('[storage] no se pudo borrar del blob:', e.message);
    }
    return;
  }

  try {
    const relativa = url.replace(/^\/uploads\//, '');
    const destino = path.join(DIR_LOCAL, relativa);
    // Evita que una url manipulada ("../../.env") escape de uploads/.
    if (!destino.startsWith(DIR_LOCAL)) {
      console.warn('[storage] ruta fuera de uploads, se ignora:', url);
      return;
    }
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
  } catch (e) {
    console.warn('[storage] no se pudo borrar del disco:', e.message);
  }
};

const modoAlmacenamiento = () => (hayBlob() ? 'vercel-blob' : 'disco-local');

module.exports = { guardarArchivo, borrarArchivo, hayBlob, modoAlmacenamiento, esUrlAbsoluta };
