import { useMemo, useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  Layers3,
  Sparkles,
  User,
} from 'lucide-react';

const AREA_COLORS = {
  VENTAS: { solid: 'var(--color-primary)', soft: 'rgb(var(--brand-600) / 0.14)' },
  ALMACEN: { solid: '#0891b2', soft: 'rgba(8,145,178,0.14)' },
  COMPRAS: { solid: '#8b5cf6', soft: 'rgba(139,92,246,0.14)' },
  ADMINISTRACION: { solid: '#f59e0b', soft: 'rgba(245,158,11,0.16)' },
  RENTA: { solid: '#16a34a', soft: 'rgba(22,163,74,0.14)' },
  TALLER: { solid: '#db2777', soft: 'rgba(219,39,119,0.14)' },
  DEFAULT: { solid: '#64748b', soft: 'rgba(100,116,139,0.14)' },
};

const STATUS_CONF = {
  PENDIENTE: {
    labelKey: 'statusTodo',
    solid: '#94a3b8',
    soft: 'rgba(148,163,184,0.18)',
    glow: 'rgba(148,163,184,0.24)',
    icon: <Clock3 size={12} />,
  },
  EN_PROGRESO: {
    labelKey: 'statusInProgress',
    solid: 'var(--color-primary)',
    soft: 'rgb(var(--brand-600) / 0.16)',
    glow: 'rgb(var(--brand-600) / 0.28)',
    icon: <Sparkles size={12} />,
  },
  HECHO: {
    labelKey: 'statusDone',
    solid: '#16a34a',
    soft: 'rgba(22,163,74,0.16)',
    glow: 'rgba(22,163,74,0.24)',
    icon: <CheckCircle2 size={12} />,
  },
};

const PRIORITY_CONF = {
  BAJA:  { labelKey: 'priorityLow',    solid: '#22c55e', soft: 'rgba(34,197,94,0.14)' },
  MEDIA: { labelKey: 'priorityMedium', solid: '#f59e0b', soft: 'rgba(245,158,11,0.14)' },
  ALTA:  { labelKey: 'priorityHigh',   solid: '#ef4444', soft: 'rgba(239,68,68,0.14)' },
};

const getLocale = () => document.documentElement.lang === 'en' ? 'en-US' : 'es-MX';
const formatFecha = (value) =>
  value ? new Date(value).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' }) : '—';

const formatMes = (value) =>
  new Date(value).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const diffDays = (from, to) =>
  Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1);

const getTaskDates = (tarea) => {
  const start = new Date(tarea.fechaInicio || tarea.creadoEn);
  const end = new Date(tarea.venceEn || tarea.fechaInicio || tarea.creadoEn);
  return { start, end };
};

const getStatusConf = (estado) => STATUS_CONF[estado] || STATUS_CONF.PENDIENTE;
const getPriorityConf = (prioridad) => PRIORITY_CONF[prioridad] || PRIORITY_CONF.MEDIA;
const getAreaConf = (area) => AREA_COLORS[area] || AREA_COLORS.DEFAULT;

const getTaskAssignees = (tarea) => {
  if (Array.isArray(tarea?.asignados) && tarea.asignados.length > 0) return tarea.asignados;
  return tarea?.asignado ? [tarea.asignado] : [];
};

const getPrimaryAssignee = (tarea) => getTaskAssignees(tarea)[0] || null;

const getTaskAssigneeLabel = (tarea, fallback) => {
  const nombres = getTaskAssignees(tarea).map((asignado) => asignado.nombre).filter(Boolean);
  return nombres.length > 0 ? nombres.join(', ') : fallback;
};

const Tooltip = ({ tarea, rect }) => {
  if (!tarea || !rect) return null;

  const status = getStatusConf(tarea.estado);
  const priority = getPriorityConf(tarea.prioridad);
  const area = getAreaConf(getPrimaryAssignee(tarea)?.area);
  const { start, end } = getTaskDates(tarea);
  const overdue = tarea.estado !== 'HECHO' && tarea.venceEn && startOfDay(tarea.venceEn) < startOfDay(new Date());

  return (
    <div
      style={{
        position: 'fixed',
        top: Math.max(16, rect.top - 156),
        left: Math.max(16, rect.left + rect.width / 2 - 130),
        zIndex: 1000,
        width: '260px',
        background: 'rgba(15,23,42,0.96)',
        border: '1px solid rgba(148,163,184,0.16)',
        borderRadius: '1rem',
        padding: '0.95rem 1rem',
        boxShadow: '0 18px 48px rgba(15,23,42,0.36)',
        pointerEvents: 'none',
        color: '#e2e8f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.55rem' }}>
        <div style={{ fontWeight: '900', color: '#fff', lineHeight: 1.25 }}>{tarea.titulo}</div>
        <span style={{ flexShrink: 0, padding: '0.22rem 0.5rem', borderRadius: '999px', background: priority.soft, color: priority.solid, fontSize: '0.68rem', fontWeight: '900' }}>
          {priority.label}
        </span>
      </div>

      <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.77rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={12} style={{ color: area.solid }} />
          {getTaskAssigneeLabel(tarea, 'Sin asignar')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarRange size={12} style={{ color: 'rgb(var(--brand-400))' }} />
          {formatFecha(start)} → {formatFecha(end)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Flag size={12} style={{ color: priority.solid }} />
          Duración: {diffDays(start, end)} día{diffDays(start, end) === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: status.solid, fontWeight: '800' }}>
          {status.icon}
          {status.label}
        </div>
        {overdue && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: '800' }}>
            <AlertTriangle size={12} />
            Vencida
          </div>
        )}
      </div>
    </div>
  );
};

const GanttView = ({ proyecto, tareas }) => {
  const { t } = usePreferences();
  const [hoveredTask, setHoveredTask] = useState(null);

  const preparedTasks = useMemo(() => (
    tareas.map((tarea) => {
      const { start, end } = getTaskDates(tarea);
      const overdue = tarea.estado !== 'HECHO' && tarea.venceEn && startOfDay(tarea.venceEn) < startOfDay(new Date());
      return {
        ...tarea,
        start,
        end,
        overdue,
        durationDays: diffDays(start, end),
      };
    }).sort((a, b) => a.start - b.start)
  ), [tareas]);

  const range = useMemo(() => {
    let start = new Date(proyecto.fechaInicio || proyecto.creadoEn || new Date());
    let end = new Date(proyecto.fechaFin || start);

    if (preparedTasks.length > 0) {
      preparedTasks.forEach((tarea) => {
        if (tarea.start < start) start = tarea.start;
        if (tarea.end > end) end = tarea.end;
      });
    }

    if (end <= start) end = new Date(start.getTime() + (14 * 86400000));

    start = new Date(start);
    end = new Date(end);
    start.setDate(start.getDate() - 3);
    end.setDate(end.getDate() + 5);

    return { start, end };
  }, [preparedTasks, proyecto]);

  const days = useMemo(() => {
    const arr = [];
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      arr.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return arr;
  }, [range]);

  const totalDays = Math.max(1, days.length - 1);

  const months = useMemo(() => {
    const result = [];
    days.forEach((day, index) => {
      const label = formatMes(day);
      const last = result[result.length - 1];
      if (!last || last.label !== label) {
        result.push({ label, startIndex: index, count: 1 });
      } else {
        last.count += 1;
      }
    });
    return result;
  }, [days]);

  const metrics = useMemo(() => {
    const total = preparedTasks.length;
    const hechas = preparedTasks.filter((t) => t.estado === 'HECHO').length;
    const enProgreso = preparedTasks.filter((t) => t.estado === 'EN_PROGRESO').length;
    const vencidas = preparedTasks.filter((t) => t.overdue).length;
    const sinAsignar = preparedTasks.filter((t) => !t.asignado?.nombre).length;
    return { total, hechas, enProgreso, vencidas, sinAsignar };
  }, [preparedTasks]);

  const getPosition = (date) => {
    const target = startOfDay(date).getTime();
    const diff = (target - startOfDay(range.start).getTime()) / 86400000;
    return (diff / totalDays) * 100;
  };

  const todayPct = getPosition(new Date());
  const DAY_WIDTH = 42;
  const NAME_WIDTH = 300;

  if (preparedTasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-surface-2)', borderRadius: '1.25rem', color: 'var(--color-text-muted)', display: 'grid', placeItems: 'center', gap: '1rem' }}>
        <div style={{ color: 'var(--color-text-dim)' }}><CalendarRange size={48} /></div>
        <p>No hay tareas programadas para visualizar el Gantt.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {hoveredTask && <Tooltip tarea={hoveredTask.tarea} rect={hoveredTask.rect} />}

      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '1.5rem',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ padding: '1.1rem 1.3rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
              {t('ganttVisualKey')}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--color-text)' }}>
              {t('ganttTimeline')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[
              { label: t('ganttTotal'),      value: metrics.total,     color: 'var(--color-text)', bg: 'var(--color-surface-3)' },
              { label: t('ganttInProgress'), value: metrics.enProgreso, color: 'var(--color-primary)', bg: 'rgb(var(--brand-600) / 0.12)' },
              { label: t('ganttDone'),       value: metrics.hechas,     color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
              { label: t('ganttOverdue'),    value: metrics.vencidas,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
            ].map((item) => (
              <div key={item.label} style={{ minWidth: '92px', padding: '0.55rem 0.75rem', borderRadius: '0.95rem', background: item.bg, color: item.color }}>
                <div style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.82 }}>{item.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: '900' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '0.9rem 1.3rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.76rem', fontWeight: '800', color: '#475569' }}>
            <Layers3 size={14} style={{ color: 'var(--color-primary)' }} />
            {t('ganttBarStatus')}
          </div>
          {Object.entries(STATUS_CONF).map(([key, conf]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: '800' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: conf.solid, boxShadow: `0 0 0 4px ${conf.soft}` }} />
              {t(conf.labelKey)}
            </div>
          ))}
          <div style={{ width: '1px', height: '16px', background: 'var(--color-border)' }} />
          {Object.entries(PRIORITY_CONF).map(([key, conf]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: '800' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: conf.solid }} />
              {t('projectPriority')} {t(conf.labelKey).toLowerCase()}
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <div style={{ minWidth: `${NAME_WIDTH + (days.length * DAY_WIDTH)}px`, position: 'relative' }}>
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
              <div
                style={{
                  width: `${NAME_WIDTH}px`,
                  padding: '1rem 1.2rem',
                  borderRight: '1px solid var(--color-border)',
                  background: 'var(--color-surface-3)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
                  {t('ganttProjectTasks')}
                </div>
                <div style={{ marginTop: '0.3rem', fontSize: '0.92rem', fontWeight: '900', color: 'var(--color-text)' }}>{proyecto?.nombre}</div>
              </div>

              <div className="flex-1">
                <div className="flex border-b border-slate-100">
                  {months.map((month) => (
                    <div
                      key={`${month.label}-${month.startIndex}`}
                      style={{
                        width: `${(month.count / days.length) * 100}%`,
                        padding: '0.6rem 0.5rem',
                        textAlign: 'left',
                        fontSize: '0.76rem',
                        fontWeight: '900',
                        color: 'var(--color-primary)',
                        textTransform: 'uppercase',
                        borderRight: '1px solid var(--color-border)',
                      }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>

                <div className="flex">
                  {days.map((day) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = startOfDay(day).getTime() === startOfDay(new Date()).getTime();
                    return (
                      <div
                        key={day.toISOString()}
                        style={{
                          flex: 1,
                          padding: '0.5rem 0',
                          textAlign: 'center',
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          color: isToday ? 'var(--color-primary)' : isWeekend ? '#ef4444' : '#94a3b8',
                          background: isToday ? 'rgb(var(--brand-600) / 0.06)' : isWeekend ? 'rgba(239,68,68,0.04)' : 'transparent',
                          borderRight: '1px solid rgba(226,232,240,0.55)',
                        }}
                      >
                        {day.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                <div style={{ width: `${NAME_WIDTH}px` }} />
                {days.map((day) => (
                  <div
                    key={`grid-${day.toISOString()}`}
                    style={{
                      flex: 1,
                      borderRight: '1px solid rgba(226,232,240,0.55)',
                      background: day.getDay() === 0 || day.getDay() === 6 ? 'rgba(248,250,252,0.8)' : 'transparent',
                    }}
                  />
                ))}
              </div>

              {preparedTasks.map((tarea, index) => {
                const status = getStatusConf(tarea.estado);
                const priority = getPriorityConf(tarea.prioridad);
                const area = getAreaConf(getPrimaryAssignee(tarea)?.area);
                const startPct = getPosition(tarea.start);
                const endPct = getPosition(tarea.end);
                const widthPct = Math.max(2.6, endPct - startPct + (100 / totalDays));

                return (
                  <div
                    key={tarea.id}
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid rgba(226,232,240,0.65)',
                      background: index % 2 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(248,250,252,0.7)',
                    }}
                  >
                    <div
                      style={{
                        width: `${NAME_WIDTH}px`,
                        padding: '0.95rem 1.2rem',
                        borderRight: '1px solid var(--color-border)',
                        background: 'rgba(255,255,255,0.94)',
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--color-text)', lineHeight: 1.2, textDecoration: tarea.estado === 'HECHO' ? 'line-through' : 'none', opacity: tarea.estado === 'HECHO' ? 0.62 : 1 }}>
                            {tarea.titulo}
                          </div>
                          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.22rem 0.45rem', borderRadius: '999px', background: status.soft, color: status.solid, fontSize: '0.68rem', fontWeight: '900' }}>
                              {status.icon}
                              {t(status.labelKey)}
                            </span>
                            <span style={{ padding: '0.22rem 0.45rem', borderRadius: '999px', background: priority.soft, color: priority.solid, fontSize: '0.68rem', fontWeight: '900' }}>
                              {t(priority.labelKey)}
                            </span>
                            {tarea.overdue && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', padding: '0.22rem 0.45rem', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', color: '#dc2626', fontSize: '0.68rem', fontWeight: '900' }}>
                                <AlertTriangle size={11} />
                                {t('taskOverdue')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: area.solid, boxShadow: `0 0 0 5px ${area.soft}`, marginTop: '0.25rem', flexShrink: 0 }} />
                      </div>

                      <div style={{ marginTop: '0.7rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.45rem 0.75rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: '800' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                          <User size={12} style={{ color: area.solid }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getTaskAssigneeLabel(tarea, t('ganttUnassigned'))}</span>
                        </span>
                        <span>{tarea.durationDays} día{tarea.durationDays === 1 ? '' : 's'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Flag size={12} style={{ color: priority.solid }} />
                          {formatFecha(tarea.end)}
                        </span>
                        <span>{getPrimaryAssignee(tarea)?.area || t('ganttGeneralArea')}</span>
                      </div>
                    </div>

                    <div className="flex-1 relative" style={{ minHeight: '86px' }}>
                      <div
                        onMouseEnter={(e) => setHoveredTask({ tarea, rect: e.currentTarget.getBoundingClientRect() })}
                        onMouseLeave={() => setHoveredTask(null)}
                        style={{
                          position: 'absolute',
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          height: '28px',
                          borderRadius: '999px',
                          background: `linear-gradient(90deg, ${status.solid} 0%, ${status.solid} 72%, ${priority.solid} 100%)`,
                          boxShadow: `0 10px 22px ${status.glow}`,
                          border: '1px solid rgba(255,255,255,0.55)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 46%)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '10px',
                            background: area.solid,
                            opacity: 0.9,
                          }}
                        />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.55rem', padding: '0 0.8rem 0 1rem', color: '#fff', fontSize: '0.72rem', fontWeight: '900' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tarea.durationDays}d
                          </span>
                          <span>{formatFecha(tarea.start)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {todayPct >= 0 && todayPct <= 100 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${NAME_WIDTH + ((days.length * DAY_WIDTH) * todayPct / 100)}px`,
                  width: '2px',
                  background: 'rgba(239,68,68,0.9)',
                  zIndex: 15,
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
                }}
              >
                <div style={{ position: 'absolute', top: '10px', left: '-5px', width: '12px', height: '12px', borderRadius: '999px', background: '#ef4444', boxShadow: '0 0 0 4px rgba(239,68,68,0.14)' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: '800' }}>
        <span>{t('ganttShowingTasks', { count: preparedTasks.length, tasks: preparedTasks.length === 1 ? t('projectTaskSingular') : t('projectTaskPlural'), days: days.length })}</span>
        <span>{t('ganttUnassignedCount', { count: metrics.sinAsignar })} · {metrics.vencidas === 1 ? t('ganttOverdueCount', { count: metrics.vencidas }) : t('ganttOverdueCountPlural', { count: metrics.vencidas })}</span>
      </div>
    </div>
  );
};

export default GanttView;
