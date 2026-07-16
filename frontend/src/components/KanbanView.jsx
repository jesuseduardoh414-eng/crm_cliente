import { useState, useRef, useLayoutEffect, useMemo, useEffect } from 'react';
import {
  Plus,
  ListTodo,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Pencil,
  Trash2,
  Calendar
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

// ── Configuración Visual ───────────────────────────────────────────────────
const COLUMNAS = [
  {
    key:      'PENDIENTE',
    labelKey: 'kanbanTodo',
    icon:     <ListTodo size={18} />,
    color:    'var(--color-text-muted)',
    bg:       'var(--color-surface-2)',
    borde:    'var(--color-border)',
    hover:    'var(--color-surface-3)',
  },
  {
    key:      'EN_PROGRESO',
    labelKey: 'kanbanInProgress',
    icon:     <Zap size={18} />,
    color:    'var(--color-primary)',
    bg:       'rgb(var(--brand-600) / 0.05)',
    borde:    'rgb(var(--brand-600) / 0.15)',
    hover:    'rgb(var(--brand-600) / 0.1)',
  },
  {
    key:      'HECHO',
    labelKey: 'kanbanDone',
    icon:     <CheckCircle2 size={18} />,
    color:    'var(--color-accent-success)',
    bg:       'rgb(16 185 129 / 0.05)',
    borde:    'rgb(16 185 129 / 0.15)',
    hover:    'rgb(16 185 129 / 0.1)',
  },
];

const PRIORIDAD_CONFIG = {
  ALTA:  { color: 'var(--color-accent-error)',   bg: 'rgb(239 68 68 / 0.1)',           labelKey: 'priorityCritical' },
  MEDIA: { color: 'var(--color-accent-warning)', bg: 'rgb(234 88 12 / 0.1)',           labelKey: 'priorityMedium' },
  BAJA:  { color: 'var(--color-primary)',        bg: 'rgb(var(--brand-600) / 0.1)',    labelKey: 'priorityNormal' },
};

const getTaskAssignees = (tarea) => {
  if (Array.isArray(tarea?.asignados) && tarea.asignados.length > 0) return tarea.asignados;
  return tarea?.asignado ? [tarea.asignado] : [];
};

const CICLO_ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'HECHO'];

// ── Utilidades ──────────────────────────────────────────────────────────────
const getLocale = () => document.documentElement.lang === 'en' ? 'en-US' : 'es-MX';
const formatFecha = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' });
};

const getDateKeyLocal = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const esVencida = (fechaStr) => {
  if (!fechaStr) return false;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f   = new Date(fechaStr); f.setHours(0,0,0,0);
  return f < hoy;
};

const getScrollSnapshot = (el, count) => {
  if (!el) return null;

  const cards = Array.from(el.querySelectorAll('[data-task-id]'));
  const anchor = cards.find((card) => card.offsetTop + card.offsetHeight > el.scrollTop) || cards[0] || null;

  return {
    count,
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    anchorTaskId: anchor?.dataset?.taskId || null,
    anchorOffsetTop: anchor?.offsetTop ?? null,
  };
};

const sortKanbanColumnTasks = (tareas = [], columna) => {
  if (columna !== 'HECHO') return tareas;

  return [...tareas].sort((a, b) => {
    return new Date(b.completadoEn || b.creadoEn || 0).getTime() - new Date(a.completadoEn || a.creadoEn || 0).getTime();
  });
};

// ── Tarjeta Kanban (Material Style) ──────────────────────────────────────────
const KanbanCard = ({ tarea, actualizando, onClick, onEditar, onEliminar, onCambiarEstado, onActualizarTarea, onDragStart }) => {
  const { t } = usePreferences();
  const prio = PRIORIDAD_CONFIG[tarea.prioridad] || PRIORIDAD_CONFIG.MEDIA;
  const idxActual = CICLO_ESTADOS.indexOf(tarea.estado);
  const sigEstado = CICLO_ESTADOS[(idxActual + 1) % CICLO_ESTADOS.length];

  return (
    <div
      data-task-id={tarea.id}
      draggable
      onDragStart={(e) => onDragStart(e, tarea.id)}
      onClick={() => onClick(tarea)}
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '1rem',
        padding: '1rem',
        cursor: actualizando ? 'wait' : 'grab',
        opacity: actualizando ? 0.6 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative'
      }}
      onMouseOver={e => {
        if (!actualizando) {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--color-border)';
      }}
    >
      {/* Badge de Prioridad */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ 
          fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', 
          letterSpacing: '0.05em', padding: '0.2rem 0.6rem', borderRadius: '4px',
          background: prio.bg, color: prio.color
        }}>
          {t(prio.labelKey)}
        </span>
        {esVencida(tarea.venceEn) && tarea.estado !== 'HECHO' && (
          <span style={{ color: 'var(--color-error)', fontSize: '0.65rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <AlertCircle size={10} /> {t('taskOverdue')}
          </span>
        )}
      </div>

      {/* Título y Desc */}
      <div>
        <h4 style={{ 
          fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.25rem',
          textDecoration: tarea.estado === 'HECHO' ? 'line-through' : 'none',
          opacity: tarea.estado === 'HECHO' ? 0.5 : 1
        }}>
          {tarea.titulo}
        </h4>
        {tarea.descripcion && (
          <p style={{ 
            fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {tarea.descripcion}
          </p>
        )}
      </div>

      {/* Info Asignado y Fecha */}
      <div style={{ 
        marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '700', color: 'var(--color-primary-light)'
          }}>
            {getTaskAssignees(tarea)[0]?.nombre?.charAt(0) || '?'}
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>
            {getTaskAssignees(tarea).map((asignado) => asignado.nombre?.split(' ')[0]).filter(Boolean).join(', ') || 'S/A'}
          </span>
        </div>
        {tarea.venceEn && (
          <span style={{ fontSize: '0.72rem', color: esVencida(tarea.venceEn) ? 'var(--color-error)' : 'var(--color-text-dim)' }}>
            {formatFecha(tarea.venceEn)}
          </span>
        )}
      </div>

      {/* Acciones Rápidas */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
        {tarea.estado !== 'HECHO' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onCambiarEstado(tarea.id, sigEstado); }}
            style={{ 
              flex: 1, padding: '0.4rem', borderRadius: '0.5rem', background: 'var(--color-surface-3)',
              border: 'none', color: 'var(--color-text)', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
            }}
          >
            {t('taskAdvance')} <ArrowRight size={12} />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); onEditar(tarea); }}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', background: 'var(--color-surface-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Pencil size={12} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onEliminar(tarea); }}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', background: 'var(--color-surface-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Columna Kanban ───────────────────────────────────────────────────────────
const KanbanColumna = ({ col, tareas, actualizando, onClick, onEditar, onEliminar, onCambiarEstado, onActualizarTarea, onDragStart, onDrop, limite, onCargarMas, scrollRef }) => {
  const { t } = usePreferences();
  const [dragOver, setDragOver] = useState(false);
  const tareasVisibles = tareas.slice(0, (tareas.length > 20 && limite === 10) ? 10 : limite);

  return (
    <div className="w-[85vw] min-w-[85vw] max-w-[85vw] md:w-auto md:min-w-0 md:max-w-none flex-shrink-0 flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{col.icon}</span>
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: col.color }}>{t(col.labelKey)}</h3>
        </div>
        <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-[10px] font-black text-slate-500">
          {tareas.length}
        </span>
      </div>

      <div
        ref={scrollRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(e, col.key); }}
        className={`
          rounded-2xl p-2 flex flex-col gap-4 transition-all duration-200 h-[70vh] min-h-[70vh] max-h-[70vh] overflow-y-auto
          ${dragOver ? 'bg-slate-50 border-2 border-dashed' : 'bg-transparent border-2 border-transparent'}
        `}
        style={{ 
          borderColor: dragOver ? col.color : 'transparent',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.1) transparent'
        }}
      >
        {tareasVisibles.map(t => (
          <KanbanCard 
            key={t.id} 
            tarea={t} 
            actualizando={actualizando === t.id}
            onClick={onClick}
            onEditar={onEditar}
            onEliminar={onEliminar}
            onCambiarEstado={onCambiarEstado}
            onActualizarTarea={onActualizarTarea}
            onDragStart={onDragStart}
          />
        ))}

        {tareas.length === 0 && (
          <div className="flex-1 min-h-[420px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-center px-6 text-center">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
              {t('taskNoTasks')}
            </span>
          </div>
        )}

        {tareas.length > tareasVisibles.length && (
          <button 
            onClick={onCargarMas}
            className="w-full py-3 bg-white/50 border border-slate-200 border-dashed rounded-xl text-[10px] font-black text-slate-500 hover:bg-white hover:border-slate-300 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {t('loadMore')} ({tareas.length - tareasVisibles.length}) <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

// ── View Principal ───────────────────────────────────────────────────────────
const KanbanView = ({ tareas, onClick, onEditar, onEliminar, onCambiarEstado, onActualizarTarea }) => {
  const { t } = usePreferences();
  const [actualizando, setActualizando] = useState(null);
  const [optimisticMoves, setOptimisticMoves] = useState({});
  const [soloHoy, setSoloHoy] = useState(true);
  const [limites, setLimites] = useState({ PENDIENTE: 10, EN_PROGRESO: 10, HECHO: 10 });
  const dragId = useRef(null);
  const columnasRef = useRef({});
  const scrollRestoreRef = useRef(null);
  const scrollFocusRef = useRef(null);

  const tareasConEstadoLocal = useMemo(() => (
    tareas.map((tarea) => {
      const movimiento = optimisticMoves[tarea.id];
      if (!movimiento) return tarea;
      return {
        ...tarea,
        estado: movimiento.estado,
        completadoEn: movimiento.completadoEn,
      };
    })
  ), [tareas, optimisticMoves]);

  useEffect(() => {
    setOptimisticMoves((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;

      let changed = false;
      const next = { ...prev };

      entries.forEach(([taskId, movimiento]) => {
        const tareaReal = tareas.find((item) => item.id === Number(taskId));
        if (!tareaReal || tareaReal.estado === movimiento.estado || tareaReal.estado === movimiento.previousEstado) {
          delete next[taskId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tareas]);

  const handleDragStart = (e, id) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const registrarSnapshotScroll = (origen, destino) => {
    const snapshot = {};

    [origen, destino].filter(Boolean).forEach((columna) => {
      const el = columnasRef.current[columna];
      if (!el) return;
      snapshot[columna] = getScrollSnapshot(
        el,
        tareasConEstadoLocal.filter(t => t.estado === columna).length
      );
    });

    scrollRestoreRef.current = Object.keys(snapshot).length > 0 ? snapshot : null;
  };

  const aplicarMovimientoOptimista = (tareaActual, nuevoEstado) => {
    if (!tareaActual || tareaActual.estado === nuevoEstado) return;

    setOptimisticMoves((prev) => ({
      ...prev,
      [Number(tareaActual.id)]: {
        previousEstado: tareaActual.estado,
        estado: nuevoEstado,
        completadoEn: nuevoEstado === 'HECHO' ? new Date().toISOString() : null,
      },
    }));

    setLimites((prev) => ({
      ...prev,
      [nuevoEstado]: Math.max(prev[nuevoEstado], tareasConEstadoLocal.filter((item) => item.estado === nuevoEstado).length + 1),
    }));
  };

  const handleCambiarEstadoKanban = async (id, nuevoEstado) => {
    const tareaActual = tareasConEstadoLocal.find(x => x.id === Number(id));
    if (!tareaActual || tareaActual.estado === nuevoEstado) return;

    aplicarMovimientoOptimista(tareaActual, nuevoEstado);
    registrarSnapshotScroll(tareaActual.estado, nuevoEstado);
    scrollFocusRef.current = nuevoEstado === 'HECHO'
      ? { column: 'HECHO', behavior: 'top' }
      : null;
    setActualizando(Number(id));

    try {
      await onCambiarEstado(Number(id), nuevoEstado);
    } finally {
      setActualizando(null);
    }
  };

  const handleDrop = async (e, colKey) => {
    const id = dragId.current;
    if (!id) return;
    const t = tareasConEstadoLocal.find(x => x.id === Number(id));
    if (t && t.estado !== colKey) {
      await handleCambiarEstadoKanban(Number(id), colKey);
    }
    dragId.current = null;
  };

  const hoy = getDateKeyLocal(new Date());
  const tareasFiltradas = soloHoy 
    ? tareasConEstadoLocal.filter(t => {
        if (optimisticMoves[t.id]) return true;
        if (t.estado === 'HECHO') {
          return t.completadoEn && getDateKeyLocal(t.completadoEn) === hoy;
        }
        return (t.fechaInicio && getDateKeyLocal(t.fechaInicio) === hoy) || (t.venceEn && getDateKeyLocal(t.venceEn) === hoy);
      })
    : tareasConEstadoLocal;

  const tareasPorColumna = useMemo(() => ({
    PENDIENTE: sortKanbanColumnTasks(
      tareasFiltradas.filter(t => t.estado === 'PENDIENTE'),
      'PENDIENTE'
    ),
    EN_PROGRESO: sortKanbanColumnTasks(
      tareasFiltradas.filter(t => t.estado === 'EN_PROGRESO'),
      'EN_PROGRESO'
    ),
    HECHO: sortKanbanColumnTasks(
      tareasFiltradas.filter(t => t.estado === 'HECHO'),
      'HECHO'
    ),
  }), [tareasFiltradas]);

  useLayoutEffect(() => {
    const snapshot = scrollRestoreRef.current;
    const scrollFocus = scrollFocusRef.current;

    if (scrollFocus?.behavior === 'top') {
      const destino = columnasRef.current[scrollFocus.column];
      if (destino) {
        destino.scrollTop = 0;
      }
      scrollFocusRef.current = null;
      scrollRestoreRef.current = null;
      return;
    }

    if (!snapshot) return;

    const cambioRealDetectado = Object.entries(snapshot).some(([columna, previo]) => {
      const totalActual = tareasPorColumna[columna]?.length ?? 0;
      return totalActual !== previo.count;
    });

    if (!cambioRealDetectado) return;

    Object.entries(snapshot).forEach(([columna, previo]) => {
      const el = columnasRef.current[columna];
      if (!el || !previo) return;

      if (previo.anchorTaskId) {
        const anchorActual = el.querySelector(`[data-task-id="${previo.anchorTaskId}"]`);
        if (anchorActual) {
          const deltaAnchor = anchorActual.offsetTop - previo.anchorOffsetTop;
          el.scrollTop = Math.max(0, previo.scrollTop + deltaAnchor);
          return;
        }
      }

      const delta = el.scrollHeight - previo.scrollHeight;
      el.scrollTop = Math.max(0, previo.scrollTop + delta);
    });

    scrollRestoreRef.current = null;
    scrollFocusRef.current = null;
  }, [tareasPorColumna]);

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro de día */}
      <div className="flex flex-wrap gap-2 lg:gap-4 items-center">
        <button 
          onClick={() => setSoloHoy(true)}
          className={`
            px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2
            ${soloHoy ? 'bg-brand-600 text-white shadow-xl shadow-brand-500/30' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}
          `}
        >
          {t('taskFilterToday')} <Calendar size={14} />
        </button>
        <button 
          onClick={() => setSoloHoy(false)}
          className={`
            px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border
            ${!soloHoy
              ? 'bg-slate-800 text-white border-slate-800 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400'}
          `}
        >
          {t('taskFilterAll')}
        </button>
      </div>

      <div className="flex md:grid md:grid-cols-3 items-start gap-4 lg:gap-8 overflow-x-auto md:overflow-visible pb-8 snap-x snap-mandatory lg:snap-none">
        {COLUMNAS.map(col => (
          <div key={col.key} className="snap-center md:min-w-0">
            <KanbanColumna 
              col={col}
              tareas={tareasPorColumna[col.key]}
              actualizando={actualizando}
              onClick={onClick}
              onEditar={onEditar}
              onEliminar={onEliminar}
              onCambiarEstado={handleCambiarEstadoKanban}
              onActualizarTarea={onActualizarTarea}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              limite={limites[col.key]}
              onCargarMas={() => setLimites(prev => ({ ...prev, [col.key]: prev[col.key] + 10 }))}
              scrollRef={(el) => { columnasRef.current[col.key] = el; }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanView;
