import { useState, useEffect, useRef } from 'react';
import { comentariosService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { puedeAdministrar } from '../utils/roles';
import { MessageSquare, Trash2, Send } from 'lucide-react';
import { PanelSkeleton } from './Skeleton';

const TaskComments = ({ tareaId, type = 'tareas', onCommentsChange }) => {
  const { usuario } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [nuevo, setNuevo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const scrollRef = useRef(null);

  const fetchComentarios = async () => {
    try {
      const data = await comentariosService.listar(tareaId, type);
      const nextComentarios = data.comentarios || [];
      setComentarios(nextComentarios);
      onCommentsChange?.(nextComentarios);
    } catch (error) {
      console.error('Error al cargar comentarios:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (tareaId) fetchComentarios();
  }, [tareaId]);

  // Scroll al final cuando hay nuevos comentarios
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comentarios]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nuevo.trim() || enviando) return;

    setEnviando(true);
    try {
      const data = await comentariosService.crear(tareaId, nuevo, type);
      setComentarios(prev => {
        const nextComentarios = [...prev, data.comentario];
        onCommentsChange?.(nextComentarios);
        return nextComentarios;
      });
      setNuevo('');
    } catch (error) {
      alert(error.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este comentario?')) return;
    try {
      await comentariosService.eliminar(id);
      setComentarios(prev => {
        const nextComentarios = prev.filter(c => c.id !== id);
        onCommentsChange?.(nextComentarios);
        return nextComentarios;
      });
    } catch (error) {
      alert(error.message);
    }
  };

  if (cargando) return <PanelSkeleton rows={4} titleWidth="190px" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Título de sección con estilo premium */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <MessageSquare size={20} style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--color-text)' }}>
          {type === 'proyectos' ? 'Muro del Proyecto' : 'Hilo de la Tarea'} <span style={{ color: 'var(--color-text-muted)', fontWeight: '400', fontSize: '0.9rem' }}>({comentarios.length})</span>
        </h3>
      </div>

      {/* Contenedor de mensajes con scroll interno */}
      <div 
        ref={scrollRef}
        style={{ 
          display: 'flex', flexDirection: 'column', gap: '1rem', 
          maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem',
          scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent'
        }}
      >
        {comentarios.length === 0 ? (
          <div style={{ 
            padding: '2.5rem 1rem', textAlign: 'center', 
            background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px dashed var(--color-border)'
          }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>No hay mensajes todavía.</p>
          </div>
        ) : (
          comentarios.map(c => {
            const esMio = c.autorId === usuario.id;
            return (
              <div key={c.id} style={{ 
                display: 'flex', gap: '0.85rem', 
                flexDirection: esMio ? 'row-reverse' : 'row',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                {/* Avatar */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: esMio ? 'var(--color-primary)' : 'var(--color-surface-3)', 
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: '800', flexShrink: 0,
                  color: esMio ? '#fff' : 'var(--color-primary)',
                  marginTop: '4px'
                }}>
                  {c.autor.nombre.charAt(0).toUpperCase()}
                </div>

                {/* Burbuja */}
                <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: esMio ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', padding: '0 0.2rem' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                      {esMio ? 'Tú' : c.autor.nombre}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {new Date(c.creadoEn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div style={{ 
                    position: 'relative',
                    fontSize: '1.05rem', lineHeight: 1.5, color: 'var(--color-text)', 
                    background: esMio ? 'rgb(var(--brand-600) / 0.15)' : 'var(--color-surface-3)', 
                    padding: '0.85rem 1.1rem', 
                    borderRadius: esMio ? '1rem 0.2rem 1rem 1rem' : '0.2rem 1rem 1rem 1rem',
                    border: esMio ? '1px solid rgb(var(--brand-600) / 0.3)' : '1px solid var(--color-border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    {c.contenido}
                    
                    {/* Botón eliminar flotante */}
                    {(esMio || puedeAdministrar(usuario)) && (
                      <button
                        onClick={() => handleEliminar(c.id)}
                        style={{ 
                          position: 'absolute', top: '-8px', [esMio ? 'left' : 'right']: '-8px',
                          background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', 
                          borderRadius: '50%', width: '22px', height: '22px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.2s',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Trash2 size={12} style={{ color: 'var(--color-accent-error)' }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input de mensaje premium */}
      <form onSubmit={handleSubmit} style={{ marginTop: '0.5rem' }}>
        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          background: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
          borderRadius: '1.25rem', padding: '0.5rem',
          transition: 'border-color 0.2s, box-shadow 0.2s'
        }}
          onFocusCapture={e => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 4px rgb(var(--brand-600) / 0.1)';
          }}
          onBlurCapture={e => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <textarea
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            placeholder="Escribe una nota o actualización..."
            style={{
              width: '100%', minHeight: '60px', padding: '0.75rem',
              background: 'transparent', border: 'none',
              color: 'var(--color-text)', fontSize: '1.05rem',
              resize: 'none', outline: 'none', fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.25rem' }}>
            <button
              type="submit"
              disabled={!nuevo.trim() || enviando}
              style={{
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '0.85rem', padding: '0.6rem 1.5rem',
                fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer',
                opacity: !nuevo.trim() || enviando ? 0.4 : 1, 
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              {enviando ? 'Enviando...' : (
                <><span>Enviar</span> <Send size={14} /></>
              )}
            </button>
          </div>
        </div>
      </form>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TaskComments;
