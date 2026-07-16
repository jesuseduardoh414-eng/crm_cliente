import { useState, useEffect, useRef } from 'react';
import { notificacionesService } from '../services/api';
import { Bell, CheckCheck, Trash2, ArrowUpRight, CalendarDays, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';

const getNotificationDestination = (notificacion) => {
  const proyectoId = notificacion.tarea?.proyectoId
    || notificacion.proyecto?.id
    || notificacion.proyectoId
    || notificacion.evento?.proyecto?.id
    || notificacion.evento?.proyectoId;

  if (proyectoId && notificacion.tarea?.id) {
    return `/proyectos/${proyectoId}?tarea=${notificacion.tarea.id}`;
  }

  if (notificacion.evento?.id || notificacion.eventoId) {
    const eventoId = notificacion.evento?.id || notificacion.eventoId;
    const fecha = notificacion.evento?.fechaInicio
      ? encodeURIComponent(notificacion.evento.fechaInicio)
      : '';
    return fecha ? `/agenda?evento=${eventoId}&fecha=${fecha}` : `/agenda?evento=${eventoId}`;
  }

  if (proyectoId) {
    return `/proyectos/${proyectoId}`;
  }

  if (notificacion.tipo === 'recordatorio') {
    return '/agenda';
  }

  return null;
};

const getNotificationMeta = (notificacion) => {
  const proyectoNombre = notificacion.tarea?.proyecto?.nombre
    || notificacion.proyecto?.nombre
    || notificacion.evento?.proyecto?.nombre;
  const actorNombre = notificacion.actorNombre
    || notificacion.evento?.creador?.nombre
    || null;

  return {
    proyectoNombre,
    actorNombre,
  };
};

const getNotificationAccent = (notificacion) => {
  if (notificacion.evento?.id || notificacion.eventoId || notificacion.tipo === 'recordatorio') {
    return {
      color: '#7c3aed',
      soft: 'rgba(124, 58, 237, 0.12)',
      icon: CalendarDays,
      label: 'Agenda',
    };
  }

  return {
    color: 'var(--color-primary)',
    soft: 'rgb(var(--brand-600) / 0.12)',
    icon: ClipboardList,
    label: 'Tarea',
  };
};

const NotificationCenter = () => {
  const { t } = usePreferences();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  const fetchNotificaciones = async () => {
    try {
      const data = await notificacionesService.listar();
      if (data?.notificaciones) {
        setNotificaciones(data.notificaciones);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    }
  };

  useEffect(() => {
    if (!usuario) return;

    fetchNotificaciones();
    
    // SISTEMA DE RESPALDO: Polling cada 15 segundos por si Realtime falla
    const interval = setInterval(() => {
      fetchNotificaciones();
    }, 15000);

    // Solo configurar Realtime si Supabase está inicializado
    const realtimeEnabled = import.meta.env.VITE_ENABLE_REALTIME === 'true';
    if (!supabase || !realtimeEnabled) return () => clearInterval(interval);

    const channel = supabase
      .channel('public:notificaciones')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => {
          console.log('[Realtime] ¡Mensaje recibido!', payload);
          if (payload.new) {
            const targetId = payload.new.usuario_id || payload.new.usuarioId;
            if (targetId == usuario.id) {
              console.log('[Realtime] Alerta para mí!');
              fetchNotificaciones(); // Refrescar lista completa para estar seguros
              if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Realtime] Estado: ${status}`);
        if (err && status !== 'CHANNEL_ERROR') console.error('[Realtime] Error:', err);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [usuario]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarcarLeida = async (id) => {
    try {
      await notificacionesService.marcarLeida(id);
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarcarTodas = async () => {
    try {
      await notificacionesService.marcarTodasLeidas();
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const handleNotificationClick = async (notificacion) => {
    try {
      if (!notificacion.leida) {
        await handleMarcarLeida(notificacion.id);
      }
    } finally {
      const destino = getNotificationDestination(notificacion);
      setOpen(false);
      if (destino) {
        navigate(destino);
      }
    }
  };

  const handleEliminarNotificacion = async (event, id) => {
    event.stopPropagation();
    try {
      await notificacionesService.eliminar(id);
      setNotificaciones((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Botón Bell */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: open ? 'var(--color-surface-3)' : 'var(--color-bg-base)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          width: '42px', height: '42px',
          borderRadius: '12px',
          position: 'relative',
          fontSize: '1.2rem',
          color: unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: open ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : 'var(--shadow-sm)',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'var(--color-surface-3)';
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }}
        onMouseOut={e => {
          if (!open) {
            e.currentTarget.style.background = 'var(--color-bg-base)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }
        }}
      >
        <Bell size={20} fill={unreadCount > 0 ? "currentColor" : "none"} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            background: 'var(--color-error)', color: '#fff',
            fontSize: '0.7rem', fontWeight: '900',
            width: '20px', height: '20px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--color-surface)',
            boxShadow: '0 2px 8px rgba(255, 255, 255, 0.2)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - Abre hacia ARRIBA porque está al fondo del sidebar */}
      {open && (
        <div style={{
          position: 'absolute', top: '120%', right: '0',
          width: '380px', background: 'var(--color-surface)',
          border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '1.5rem',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.18)',
          zIndex: 1000, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'slideDown 0.2s ease-out'
        }}>
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div style={{
            padding: '1rem 1rem 0.9rem', borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--color-text)' }}>{t('notificationsTitle')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                {unreadCount > 0 ? t('notificationsPending', { count: unreadCount }) : t('notificationsAllGood')}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarcarTodas}
                style={{
                  background: 'rgb(var(--brand-600) / 0.08)',
                  border: '1px solid rgb(var(--brand-600) / 0.14)',
                  color: 'var(--color-primary)',
                  fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.5rem 0.7rem',
                  borderRadius: '999px'
                }}
              >
                <CheckCheck size={14} /> {t('notificationsMarkAll')}
              </button>
            )}
          </div>

          <div style={{ maxHeight: '430px', overflowY: 'auto', padding: '0.65rem' }}>
            {notificaciones.length === 0 ? (
              <div style={{
                margin: '0.35rem',
                padding: '2.25rem 1rem',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: '0.92rem',
                borderRadius: '1.2rem',
                background: 'var(--color-surface-3)',
                border: '1px dashed rgba(148, 163, 184, 0.28)'
              }}>
                {t('notificationsEmpty')}
              </div>
              ) : (
                notificaciones.map(n => (
                  (() => {
                    const destino = getNotificationDestination(n);
                    const { proyectoNombre, actorNombre } = getNotificationMeta(n);
                    const accent = getNotificationAccent(n);
                    const AccentIcon = accent.icon;
                    return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      marginBottom: '0.6rem',
                      padding: '0.95rem',
                      cursor: destino ? 'pointer' : (n.leida ? 'default' : 'pointer'),
                      background: n.leida ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
                      position: 'relative',
                      borderRadius: '1.15rem',
                      border: n.leida ? '1px solid rgba(226, 232, 240, 0.8)' : `1px solid ${accent.soft}`,
                      boxShadow: n.leida ? '0 6px 16px rgba(15, 23, 42, 0.05)' : '0 12px 24px rgb(var(--brand-600) / 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{
                        width: '2.35rem',
                        height: '2.35rem',
                        borderRadius: '0.9rem',
                        background: accent.soft,
                        color: accent.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `inset 0 0 0 1px ${accent.soft}`,
                      }}>
                        <AccentIcon size={16} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: '900',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: accent.color,
                              background: accent.soft,
                              padding: '0.22rem 0.45rem',
                              borderRadius: '999px'
                            }}>
                              {accent.label}
                            </span>
                            {!n.leida && (
                              <span style={{
                                width: '0.48rem',
                                height: '0.48rem',
                                borderRadius: '999px',
                                background: accent.color,
                                boxShadow: `0 0 0 4px ${accent.soft}`
                              }} />
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(event) => handleEliminarNotificacion(event, n.id)}
                            aria-label="Eliminar notificación"
                            style={{
                              border: '1px solid rgba(248, 113, 113, 0.18)',
                              background: 'rgba(254, 242, 242, 0.95)',
                              color: '#ef4444',
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: n.leida ? '600' : '800',
                          color: 'var(--color-text)',
                          lineHeight: 1.38,
                          marginBottom: '0.45rem'
                        }}>
                          {n.mensaje}
                        </div>

                        {(proyectoNombre || actorNombre) && (
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.4rem',
                            marginBottom: '0.55rem',
                          }}>
                            {proyectoNombre && (
                              <span style={{
                                fontSize: '0.68rem',
                                color: '#475569',
                                background: 'rgba(241, 245, 249, 0.95)',
                                padding: '0.28rem 0.5rem',
                                borderRadius: '999px',
                                fontWeight: '700'
                              }}>
                                Proyecto: {proyectoNombre}
                              </span>
                            )}
                            {actorNombre && (
                              <span style={{
                                fontSize: '0.68rem',
                                color: '#475569',
                                background: 'rgba(241, 245, 249, 0.95)',
                                padding: '0.28rem 0.5rem',
                                borderRadius: '999px',
                                fontWeight: '700'
                              }}>
                                {n.tipo === 'recordatorio' ? 'Invitó' : 'Asignó'}: {actorNombre}
                              </span>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>
                            {new Date(n.creadaEn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {destino && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.72rem',
                              color: accent.color,
                              fontWeight: '800'
                            }}>
                              Ver detalle <ArrowUpRight size={13} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                    );
                  })()
                ))
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

