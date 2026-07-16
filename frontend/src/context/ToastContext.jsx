// Sistema de Toasts globales
// Provee: showToast({ message, type }) desde cualquier componente

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TIPOS = {
  success: { color: '#fff', bg: '#10b981', border: '#059669', icon: <CheckCircle2 size={16} strokeWidth={3} /> },
  error:   { color: '#fff', bg: '#ef4444', border: '#dc2626', icon: <XCircle size={16} strokeWidth={3} /> },
  info:    { color: '#fff', bg: 'var(--color-primary-light)', border: 'var(--color-primary)', icon: <Info size={16} strokeWidth={3} /> },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Contenedor fijo de toasts */}
      <div style={{
        position: 'fixed', bottom: '2rem', right: '2rem',
        zIndex: 9999, display: 'flex', flexDirection: 'column',
        gap: '0.75rem', maxWidth: '400px',
      }}>
        {toasts.map(toast => {
          const conf = TIPOS[toast.type] || TIPOS.info;
          return (
            <div
              key={toast.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                background: conf.bg,
                border: `1px solid ${conf.border}`,
                borderRadius: '1rem',
                color: conf.color,
                fontSize: '0.9rem', fontWeight: '700',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                animation: 'toastIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                backdropFilter: 'blur(4px)',
                minWidth: '280px'
              }}
            >
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: 'rgba(255,255,255,0.2)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' 
              }}>
                {conf.icon}
              </div>
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                  cursor: 'pointer', width: '20px', height: '20px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.95); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
};
