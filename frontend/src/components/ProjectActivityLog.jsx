import { useState, useEffect } from 'react';
import { logsService } from '../services/api';
import { 
  PlusCircle, 
  Pencil, 
  Zap, 
  MessageSquare, 
  Trash2, 
  History,
  RotateCw,
  Inbox
} from 'lucide-react';
import { PanelSkeleton } from './Skeleton';

const ProjectActivityLog = ({ proyectoId }) => {
  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);

  const fetchLogs = async () => {
    try {
      const data = await logsService.listarPorProyecto(proyectoId);
      setLogs(data.logs);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (proyectoId) fetchLogs();
  }, [proyectoId]);

  const getIcon = (accion) => {
    switch (accion) {
      case 'CREAR_TAREA':      return <PlusCircle size={18} />;
      case 'EDITAR_TAREA':     return <Pencil size={18} />;
      case 'CAMBIO_ESTADO':    return <Zap size={18} />;
      case 'NUEVO_COMENTARIO': return <MessageSquare size={18} />;
      case 'ELIMINAR_TAREA':   return <Trash2 size={18} />;
      default: return <History size={18} />;
    }
  };

  const getBadgeColor = (accion) => {
    if (accion.includes('ELIMINAR')) return '#f87171';
    if (accion.includes('CREAR'))    return '#34d399';
    if (accion.includes('ESTADO'))   return '#818cf8';
    return '#94a3b8';
  };

  if (cargando) return <PanelSkeleton rows={5} titleWidth="210px" />;

  return (
    <div style={{ background: 'var(--color-surface-2)', borderRadius: '1.25rem', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Historial de Actividad</h3>
        <button 
          onClick={fetchLogs} 
          style={{ 
            background: 'none', border: 'none', color: 'var(--color-primary)', 
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}
        >
          Actualizar <RotateCw size={14} />
        </button>
      </div>

      <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '1rem' }}>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--color-text-dim)' }}><Inbox size={32} /></div>
            No hay actividades registradas aún.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {logs.map((log, idx) => (
              <div key={log.id} style={{ 
                display: 'flex', gap: '1rem', padding: '1rem', 
                background: 'rgba(255,255,255,0.02)', borderRadius: '1rem',
                border: '1px solid transparent',
                transition: 'all 0.2s',
                position: 'relative'
              }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* Línea de tiempo conectora */}
                {idx < logs.length - 1 && (
                  <div style={{ 
                    position: 'absolute', left: '31px', top: '45px', bottom: '-15px', 
                    width: '2px', background: 'var(--color-border)', opacity: 0.3, zIndex: 0 
                  }} />
                )}

                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '50%', 
                  background: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontSize: '1.1rem', flexShrink: 0, zIndex: 1
                }}>
                  {getIcon(log.accion)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: '800', padding: '0.1rem 0.5rem', 
                      borderRadius: '4px', background: getBadgeColor(log.accion) + '22', color: getBadgeColor(log.accion),
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {log.accion.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {new Date(log.creadoEn).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
                    {log.descripcion}
                  </p>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                      {log.usuario.nombre.charAt(0).toUpperCase()}
                    </div>
                    {log.usuario.nombre} • {log.usuario.area}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectActivityLog;
