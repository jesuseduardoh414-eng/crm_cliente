// Contexto global de autenticación
// Provee: usuario actual, funciones de login/logout y estado de carga
// Nota: hook y provider en el mismo archivo es compatible con Vite Fast Refresh

import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario]   = useState(null);
  const [cargando, setCargando] = useState(true); // Verifica token al iniciar

  // Al montar, verificar si hay un token guardado y validarlo
  useEffect(() => {
    const verificarSesion = async () => {
      const token = localStorage.getItem('crm_token');
      if (!token) {
        setCargando(false);
        return;
      }
      try {
        const data = await authService.me();
        setUsuario(data.usuario);
      } catch {
        // Token inválido o expirado — limpiar
        localStorage.removeItem('crm_token');
      } finally {
        setCargando(false);
      }
    };

    verificarSesion();
  }, []);

  // Guardar token y actualizar estado del usuario
  const login = (token, datosUsuario) => {
    localStorage.setItem('crm_token', token);
    setUsuario(datosUsuario);
  };

  // Eliminar token y limpiar el estado
  const logout = () => {
    localStorage.removeItem('crm_token');
    setUsuario(null);
  };

  const updateUsuario = (datosUsuario) => {
    setUsuario((prev) => prev ? { ...prev, ...datosUsuario } : datosUsuario);
  };

  const refreshUsuario = async () => {
    const data = await authService.me();
    setUsuario(data.usuario);
    return data.usuario;
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, updateUsuario, refreshUsuario }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para consumir el contexto fácilmente
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
