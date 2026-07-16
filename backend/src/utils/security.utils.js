/**
 * Utilidades de seguridad para validación de contraseñas y sanitización
 */

const validarPassword = (password) => {
  const errores = [];

  // 1. Longitud mínima
  if (password.length < 8) {
    errores.push('La contraseña debe tener al menos 8 caracteres');
  }

  // 2. Complejidad (Mayúsculas, Minúsculas, Números, Símbolos)
  if (!/[A-Z]/.test(password)) {
    errores.push('Debe contener al menos una letra mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errores.push('Debe contener al menos una letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errores.push('Debe contener al menos un número');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errores.push('Debe contener al menos un carácter especial');
  }

  // 3. Patrones secuenciales o repetitivos
  const sequentialPatterns = [
    '123456', 'qwerty', 'password', 'admin', 'abcde'
  ];
  if (sequentialPatterns.some(p => password.toLowerCase().includes(p))) {
    errores.push('No uses patrones comunes o secuenciales');
  }

  // Verificar caracteres repetidos (ej: aaaa)
  if (/(.)\1{3,}/.test(password)) {
    errores.push('Evita repetir el mismo carácter más de 3 veces');
  }

  return {
    valido: errores.length === 0,
    errores
  };
};

module.exports = { validarPassword };
