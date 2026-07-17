// Página de detalle de un Proyecto
// Muestra info del proyecto, barra de progreso, contadores y lista de tareas
// Vistas: Lista | Kanban | Gantt | Muro

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { maquinasService, proyectosService, tareasService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { puedeAdministrar } from '../utils/roles';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import KanbanView from '../components/KanbanView';
import GanttView  from '../components/GanttView';
import { PageSkeleton } from '../components/Skeleton';
import ModalImportar from '../components/ModalImportar';
import RangeDatePicker from '../components/RangeDatePicker';
import TaskAttachments from '../components/TaskAttachments';
import TaskComments from '../components/TaskComments';
import ProyectoMaquinaria from '../components/ProyectoMaquinaria';
import { sortTareas, sortTareasLista } from '../utils/sorters';
import { 
  Target, 
  ListTodo, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw, 
  Trash2, 
  Download, 
  Plus,
  Save,
  FileJson,
  FileSpreadsheet,
  List,
  LayoutGrid,
  CalendarRange,
  ChevronLeft,
  AlertTriangle,
  Search,
  User2,
  Forklift,
  SlidersHorizontal
} from 'lucide-react';

// ── Configuraciones ─────────────────────────────────────────────────────────
const PRIORIDADES = [
  { value: 'BAJA',  labelKey: 'priorityLow',    color: '#00a2ff', bg: 'rgba(0,162,255,0.1)' },
  { value: 'MEDIA', labelKey: 'priorityMedium', color: '#ff9100', bg: 'rgba(255,145,0,0.1)' },
  { value: 'ALTA',  labelKey: 'priorityHigh',   color: '#ff0055', bg: 'rgba(255,0,85,0.1)' },
];

const ESTADOS_TAREA = [
  { value: 'PENDIENTE',   labelKey: 'statusTodo',       color: '#6c757d' },
  { value: 'EN_PROGRESO', labelKey: 'statusInProgress', color: '#00a2ff' },
  { value: 'HECHO',       labelKey: 'statusDone',       color: '#00d166' },
];

const getPrioridad  = (v) => PRIORIDADES.find(p => p.value === v) || PRIORIDADES[1];
const getEstadoConf = (v) => ESTADOS_TAREA.find(e => e.value === v) || ESTADOS_TAREA[0];

const getLocale = () => document.documentElement.lang === 'en' ? 'en-US' : 'es-MX';
const formatFecha = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' });
};

const getDateAtNoon = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
};

const inicioDiaLocal = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const esFechaVencida = (value) => (
  Boolean(value) && inicioDiaLocal(value) < inicioDiaLocal(new Date())
);

const getHoyMediodiaIso = () => {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  return hoy.toISOString();
};

const getVenceEnOptimista = (tarea, nuevoEstado) => {
  if (!tarea?.venceEn) return tarea?.venceEn;
  if (nuevoEstado === 'HECHO') return getHoyMediodiaIso();
  return esFechaVencida(tarea.venceEn)
    ? getHoyMediodiaIso()
    : tarea.venceEn;
};

const tareaCoincideConRango = (tarea, rango) => {
  if (!rango?.from && !rango?.to) return true;

  const fechaInicio = getDateAtNoon(tarea.fechaInicio);
  const fechaFin = getDateAtNoon(tarea.venceEn || tarea.fechaInicio);

  if (!fechaInicio && !fechaFin) return false;

  const inicio = fechaInicio || fechaFin;
  const fin = fechaFin || fechaInicio;
  const from = getDateAtNoon(rango.from);
  const to = getDateAtNoon(rango.to || rango.from);

  if (from && fin < from) return false;
  if (to && inicio > to) return false;

  return true;
};

const getTaskAssignees = (tarea) => {
  if (Array.isArray(tarea?.asignados) && tarea.asignados.length > 0) return tarea.asignados;
  return tarea?.asignado ? [tarea.asignado] : [];
};

const isTaskAssignedToUser = (tarea, usuarioId) => (
  getTaskAssignees(tarea).some((asignado) => asignado.id === usuarioId)
);

const getTaskAssigneeNames = (tarea, fallback) => {
  const nombres = getTaskAssignees(tarea).map((asignado) => asignado.nombre).filter(Boolean);
  return nombres.length > 0 ? nombres.join(', ') : fallback;
};

// ── Tarjeta de Tarea (List View) ─────────────────────────────────────────────
const TareaCard = ({ tarea, usuarioActual, onClick, onEliminar, onCambiarEstado }) => {
  const { t } = usePreferences();
  const prio = getPrioridad(tarea.prioridad);
  const estado = getEstadoConf(tarea.estado);
  const CICLO = ['PENDIENTE', 'EN_PROGRESO', 'HECHO'];
  const sigEstado = CICLO[(CICLO.indexOf(tarea.estado) + 1) % CICLO.length];
  const vencido = esFechaVencida(tarea.venceEn) && tarea.estado !== 'HECHO';
  const asignados = getTaskAssignees(tarea);
  const creadorEsUsuarioActual = tarea.creador?.id === usuarioActual?.id
    || (!tarea.creador?.id && (asignados.length === 0 || isTaskAssignedToUser(tarea, usuarioActual?.id)));
  const asignadorLabel = creadorEsUsuarioActual
    ? t('taskCreatedByYou')
    : `${t('taskAssignedBy')} ${tarea.creador?.nombre || t('taskCreatedBySystem')}`;
  const responsableLabel = isTaskAssignedToUser(tarea, usuarioActual?.id)
    ? t('taskAssignedToYou')
    : `${t('projectResponsible')}: ${getTaskAssigneeNames(tarea, t('taskUnassigned'))}`;

  return (
    <div 
      onClick={() => onClick(tarea)}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 lg:p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 hover:translate-x-1 transition-all cursor-pointer shadow-sm hover:shadow-md"
    >
      {/* Icono de Estado y Título */}
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full shrink-0 mt-1.5" 
          style={{ background: estado.color, boxShadow: `0 0 10px ${estado.color}55` }} 
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className={`text-sm lg:text-base font-bold text-[var(--color-text)] truncate ${tarea.estado === 'HECHO' ? 'line-through opacity-40' : ''}`}>
              {tarea.titulo}
            </h4>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ background: prio.bg, color: prio.color }}>
              {t(prio.labelKey)}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] truncate font-medium">
            {tarea.descripcion || t('taskNoDescription')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <User2 size={12} />
              {responsableLabel}
            </span>
            <span className="hidden text-[var(--color-border)] lg:inline">•</span>
            <span className="inline-flex items-center gap-1 text-[var(--color-text-dim)]">
              {asignadorLabel}
            </span>
            {tarea.maquina && (
              <>
                <span className="hidden text-[var(--color-border)] lg:inline">•</span>
                <Link
                  to="/maquinaria"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-100 hover:bg-brand-100 transition-colors"
                >
                  <Forklift size={11} />
                  {tarea.maquina.nombre}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-[var(--color-border-light)]">
        {/* Fecha */}
        <div className={`text-[10px] lg:text-xs font-black shrink-0 flex items-center gap-1 ${vencido ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
          {tarea.venceEn ? (
            <>
              {vencido && <AlertTriangle size={12} />}
              {formatFecha(tarea.venceEn)}
            </>
          ) : '-'}
        </div>

        <div className="flex gap-2 ml-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onCambiarEstado(tarea.id, sigEstado); }}
            className="p-2 lg:p-2.5 bg-[var(--color-surface-3)] text-[var(--color-text-dim)] rounded-xl hover:brightness-105 transition-colors border border-[var(--color-border)]"
          >
            {tarea.estado === 'HECHO' ? <RotateCcw size={14} /> : <ArrowRight size={14} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEliminar(tarea); }}
            className="p-2 lg:p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Toggle Vista (Material) ─────────────────────────────────────────────────
const ToggleVista = ({ vista, onChange, t }) => (
  <div className="flex bg-[var(--color-surface-3)] p-1 rounded-xl border border-[var(--color-border)] gap-1 w-full lg:w-auto">
    {[
      { k: 'lista',  l: t('projectList'), i: <List size={16} /> },
      { k: 'kanban', l: t('projectKanban'), i: <LayoutGrid size={16} /> },
      { k: 'gantt',  l: t('projectGantt'), i: <CalendarRange size={16} /> }
    ].map(v => (
      <button 
        key={v.k} onClick={() => onChange(v.k)}
        className={`
          flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs lg:text-sm font-black transition-all
          ${vista === v.k ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'text-[var(--color-text-dim)] hover:bg-[var(--color-surface)]'}
        `}
      >
        {v.i} <span className="hidden lg:inline">{v.l}</span>
      </button>
    ))}
  </div>
);

// ── Main Page Component ─────────────────────────────────────────────────────
const ProyectoDetallePage = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { usuario } = useAuth();
  const { t } = usePreferences();
  const { showToast } = useToast();

  const [proyecto, setProyecto] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  // Misma regla que el backend: la mesa directiva, o quien sea miembro de la
  // obra. El consejo supervisa pero no gestiona: si no es miembro, no ve el
  // botón. Si el backend dice que no, responde 403; esto solo evita enseñar
  // botones que no van a funcionar.
  const puedeGestionarMaquinaria = puedeAdministrar(usuario)
    || (usuarios || []).some((u) => u.id === usuario?.id);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalExportar, setModalExportar] = useState(false);
  const [modalPlantilla, setModalPlantilla] = useState(false);
  const [tareaEditando, setTareaEditando] = useState(null);
  const [vista, setVista] = useState('lista');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(10);
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas');
  const [filtroResponsable, setFiltroResponsable] = useState('todos');
  const [filtroFecha, setFiltroFecha] = useState({ from: null, to: null });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const t = await tareasService.listar(id);
      setProyecto(t.proyecto);
      setTareas(sortTareas(t.tareas));
      setUsuarios(t.proyecto?.miembros || []);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setCargando(false); }
  }, [id, showToast]);

  useEffect(() => { 
    const fetch = async () => {
      await cargar();
    };
    fetch();
  }, [cargar]);

  useEffect(() => {
    const tareaIdParam = searchParams.get('tarea');
    if (!tareaIdParam || !tareas.length) return;

    const tareaObjetivo = tareas.find((item) => String(item.id) === tareaIdParam);
    if (!tareaObjetivo) return;

    setTareaEditando(tareaObjetivo);
    setModal(true);
  }, [searchParams, tareas]);

  const cerrarModalTarea = useCallback(() => {
    setModal(false);
    setTareaEditando(null);

    if (searchParams.get('tarea')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('tarea');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const stats = useMemo(() => {
    const hechas = tareas.filter(t => t.estado === 'HECHO').length;
    const prog = tareas.filter(t => t.estado === 'EN_PROGRESO').length;
    const pendientes = tareas.filter(t => t.estado === 'PENDIENTE').length;
    const total = tareas.length;
    const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

    const tareasMiembro = tareas.filter((t) => isTaskAssignedToUser(t, usuario?.id));
    const hechasMiembro = tareasMiembro.filter(t => t.estado === 'HECHO').length;
    const pctMiembro = tareasMiembro.length > 0 ? Math.round((hechasMiembro / tareasMiembro.length) * 100) : 0;

    return {
      total,
      hechas,
      progreso: prog,
      pendientes,
      pct,
      totalMiembro: tareasMiembro.length,
      hechasMiembro,
      pctMiembro,
    };
  }, [tareas, usuario?.id]);

  const progresoGeneral = stats.pct;
  const progresoMiembro = stats.pctMiembro;
  const totalGeneral = stats.total;
  const totalMiembro = stats.totalMiembro;

  const tareasFiltradas = useMemo(() => {
    if (!busqueda) return tareas;
    const b = busqueda.toLowerCase();
    return tareas.filter(t => 
      t.titulo?.toLowerCase().includes(b) || 
      t.descripcion?.toLowerCase().includes(b)
    );
  }, [tareas, busqueda]);

  const responsablesFiltro = useMemo(() => {
    const mapa = new Map();
    tareas.forEach((tarea) => {
      getTaskAssignees(tarea).forEach((asignado) => {
        mapa.set(String(asignado.id), asignado);
      });
    });
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [tareas]);

  const tareasFiltradasAvanzadas = useMemo(() => (
    tareasFiltradas.filter((tarea) => {
      if (filtroPrioridad !== 'todas' && tarea.prioridad !== filtroPrioridad) return false;

      if (filtroResponsable !== 'todos') {
        if (filtroResponsable === 'sin_asignar') {
          if (getTaskAssignees(tarea).length > 0) return false;
        } else if (!getTaskAssignees(tarea).some((asignado) => String(asignado.id) === filtroResponsable)) {
          return false;
        }
      }

      if (!tareaCoincideConRango(tarea, filtroFecha)) return false;

      return true;
    })
  ), [filtroFecha, filtroPrioridad, filtroResponsable, tareasFiltradas]);

  const tareasListaFiltradas = useMemo(() => sortTareasLista(tareasFiltradasAvanzadas), [tareasFiltradasAvanzadas]);

  const handleEliminar = async (tarea) => {
    if (!window.confirm(t('taskDeleteConfirm', { name: tarea.titulo }))) return;
    try {
      await tareasService.eliminar(tarea.id);
      setTareas(prev => prev.filter(x => x.id !== tarea.id));
      showToast(t('taskDeleted'));
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleCambiarEstado = async (id, est) => {
    const tareaAnterior = tareas.find(x => x.id === id);
    if (!tareaAnterior || tareaAnterior.estado === est) return;

    const completadoEnOptimista = est === 'HECHO'
      ? new Date().toISOString()
      : null;

    const tareaOptimista = {
      ...tareaAnterior,
      estado: est,
      completadoEn: completadoEnOptimista,
      venceEn: getVenceEnOptimista(tareaAnterior, est),
    };

    setTareas(prev => sortTareas(prev.map(x => x.id === id ? tareaOptimista : x)));

    if (tareaEditando?.id === id) {
      setTareaEditando(prev => prev ? { ...prev, estado: est, completadoEn: completadoEnOptimista, venceEn: getVenceEnOptimista(prev, est) } : prev);
    }

    try {
      const { tarea } = await tareasService.actualizarEstado(id, est);
      const tareaConfirmada = {
        ...tareaAnterior,
        ...tarea,
        estado: est,
        completadoEn: est === 'HECHO'
          ? (tarea.completadoEn || completadoEnOptimista)
          : null,
        venceEn: getVenceEnOptimista(tarea, est),
      };

      setTareas(prev => sortTareas(prev.map(x => x.id === id ? tareaConfirmada : x)));
      if (tareaEditando?.id === id) {
        setTareaEditando(tareaConfirmada);
      }
    } catch (err) {
      setTareas(prev => sortTareas(prev.map(x => x.id === id ? tareaAnterior : x)));
      if (tareaEditando?.id === id) {
        setTareaEditando(tareaAnterior);
      }
      showToast(err.message, 'error');
    }
  };

  const handleActualizarTarea = async (id, datos) => {
    try {
      const { tarea } = await tareasService.editar(id, datos);
      setTareas(prev => sortTareas(prev.map(x => x.id === id ? tarea : x)));
      showToast(t('taskUpdated'));
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleGuardarTarea = useCallback(({ tarea, creada = false } = {}) => {
    if (!tarea) {
      cerrarModalTarea();
      return;
    }

    setTareas((prev) => {
      const existe = prev.some((item) => item.id === tarea.id);
      const siguientes = existe
        ? prev.map((item) => (item.id === tarea.id ? { ...item, ...tarea } : item))
        : [tarea, ...prev];

      return sortTareas(siguientes);
    });

    setTareaEditando((prev) => (prev?.id === tarea.id ? { ...prev, ...tarea } : prev));
    cerrarModalTarea();
    showToast(creada ? t('taskCreated') : t('taskUpdated'));
  }, [cerrarModalTarea, showToast, t]);

  const handleSincronizarTarea = useCallback((tareaId, cambios = {}) => {
    if (!tareaId || !cambios || Object.keys(cambios).length === 0) return;

    setTareas((prev) => sortTareas(
      prev.map((tarea) => (tarea.id === tareaId ? { ...tarea, ...cambios } : tarea))
    ));
    setTareaEditando((prev) => (prev?.id === tareaId ? { ...prev, ...cambios } : prev));
  }, []);

  const handleImportado = useCallback((resultado = {}) => {
    const tareasImportadas = Array.isArray(resultado.tareas) ? resultado.tareas : [];

    if (tareasImportadas.length > 0) {
      setTareas((prev) => {
        const existentes = new Set(prev.map((tarea) => tarea.id));
        const nuevas = tareasImportadas.filter((tarea) => !existentes.has(tarea.id));
        return sortTareas([...prev, ...nuevas]);
      });
    }

    setModalImportar(false);
    showToast(t('taskImportSuccess', { count: resultado.creadas || tareasImportadas.length || 0 }));
  }, [showToast, t]);

  const handleExportar = (tipo) => {
    try {
      tareasService.exportarProyecto(id, tipo);
      showToast(t('taskExportStarted', { type: tipo.toUpperCase() }));
      setModalExportar(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGuardarPlantilla = async ({ nombre, descripcion }) => {
    try {
      await proyectosService.guardarComoPlantilla(id, { nombre, descripcion });
      showToast(t('taskTemplateSaved'));
      setModalPlantilla(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (cargando) return <PageSkeleton cards={4} />;

  return (
    <div className="max-w-7xl mx-auto">
      
      {/* Header Premium */}
      <div className="mb-10 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Link to="/proyectos" className="text-brand-600 font-black text-[10px] lg:text-xs tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
              <ChevronLeft size={14} /> {String(t('projects')).toUpperCase()}
            </Link>
            <span className="text-[var(--color-border)]">/</span>
            <span className="text-[10px] font-black text-[var(--color-text-muted)] tracking-widest truncate max-w-[200px]">ID #{proyecto?.id}</span>
          </div>
          <h1 className="text-2xl lg:text-5xl font-black text-[var(--color-text)] tracking-tight leading-tight mb-2">
            {proyecto?.nombre}
          </h1>
          <p className="text-sm lg:text-base text-[var(--color-text-dim)] font-medium max-w-2xl">{proyecto?.descripcion}</p>
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <button 
            onClick={() => setModalExportar(true)} 
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 lg:py-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs lg:text-sm font-black text-[var(--color-text-dim)] hover:bg-[var(--color-surface-3)] transition-all shadow-sm"
          >
            <Download size={18} /> {t('projectExport')}
          </button>
          {puedeAdministrar(usuario) && (
            <button
              onClick={() => setModalPlantilla(true)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 lg:py-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs lg:text-sm font-black text-[var(--color-text-dim)] hover:bg-[var(--color-surface-3)] transition-all shadow-sm"
            >
              <Save size={18} /> {t('projectSaveTemplate')}
            </button>
          )}
          <button 
            onClick={() => setModalImportar(true)} 
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 lg:py-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs lg:text-sm font-black text-[var(--color-text-dim)] hover:bg-[var(--color-surface-3)] transition-all shadow-sm"
          >
            <Download size={18} /> {t('projectImport')}
          </button>
          <button 
            onClick={() => { setTareaEditando(null); setModal(true); }} 
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 lg:py-3.5 bg-brand-600 text-white rounded-xl text-xs lg:text-sm font-black hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
          >
            <Plus size={18} /> {t('projectNewTask')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10 overflow-x-auto pb-2 lg:pb-0">
        {[
          { l: t('projectGeneralProgress'), v: `${progresoGeneral}%`, sub: `${totalGeneral} ${totalGeneral === 1 ? t('projectTaskSingular') : t('projectTaskPlural')}`, i: <Target size={24} />, c: 'var(--color-primary)', bg: 'rgb(var(--brand-600) / 0.12)' },
          { l: t('projectMyProgress'), v: `${progresoMiembro}%`, sub: `${totalMiembro} ${t('taskAssignedPlural')}`, i: <Target size={24} />, c: '#10b981', bg: 'rgba(16,185,129,0.12)' },
          { l: t('projectTodo'), v: stats.pendientes, i: <ListTodo size={24} />, c: '#64748b', bg: 'var(--color-surface-3)' },
          { l: t('projectInProgress'), v: stats.progreso, i: <Zap size={24} />, c: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
          { l: t('projectDone'), v: stats.hechas, i: <CheckCircle2 size={24} />, c: '#10b981', bg: 'rgba(16,185,129,0.12)' }
        ].map((s, i) => (
          <div key={i} className="bg-[var(--color-surface)] p-5 lg:p-6 rounded-[24px] shadow-sm border border-[var(--color-border)] flex items-center justify-between min-w-[140px]">
            <div className="flex flex-col gap-0.5">
              <div className="text-xl lg:text-2xl font-black text-[var(--color-text)] leading-none">{s.v}</div>
              <div className="text-[9px] lg:text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{s.l}</div>
              {s.sub && <div className="text-[9px] font-black text-[var(--color-text-muted)] opacity-70 uppercase tracking-widest">{s.sub}</div>}
            </div>
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg, color: s.c }}>
              {s.i}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar Vistas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '300px' }}>
          <ToggleVista vista={vista} onChange={setVista} t={t} />
          
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)', opacity: 0.5 }} />
            <input 
              type="text"
              placeholder={t('projectTaskSearch')}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.5rem',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: '600',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>
        </div>
        
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('projectShowing')} {tareasFiltradasAvanzadas.length} {tareasFiltradasAvanzadas.length === 1 ? t('projectTaskSingular') : t('projectTaskPlural')}
          </span>
        </div>
      </div>

      {/* Maquinaria de la obra: qué máquinas tiene y quién las opera. */}
      <ProyectoMaquinaria proyectoId={Number(id)} puedeGestionar={puedeGestionarMaquinaria} />

      <div className="mb-6 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 lg:px-5 lg:py-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-surface-3)] text-[var(--color-text-dim)]">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('projectTaskFilters')}</div>
            <div className="text-sm font-black text-[var(--color-text)]">{t('projectTaskFiltersDesc')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('projectDate')}</label>
            <RangeDatePicker
              from={filtroFecha.from}
              to={filtroFecha.to}
              onChange={(range) => setFiltroFecha(range || { from: null, to: null })}
              placeholder={t('projectSelectDate')}
              title={t('projectSelectDate')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('projectPriority')}</label>
            <select
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-3)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-dim)] outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
            >
              <option value="todas">{t('projectAllPriorities')}</option>
              {PRIORIDADES.map((prioridad) => (
                <option key={prioridad.value} value={prioridad.value}>{t(prioridad.labelKey)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('projectResponsible')}</label>
            <select
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-3)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-dim)] outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              value={filtroResponsable}
              onChange={(e) => setFiltroResponsable(e.target.value)}
            >
              <option value="todos">{t('projectAllResponsibles')}</option>
              <option value="sin_asignar">{t('projectUnassigned')}</option>
              {responsablesFiltro.map((responsable) => (
                <option key={responsable.id} value={String(responsable.id)}>{responsable.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Canvas */}
      <div style={{ minHeight: '500px' }}>
        {vista === 'lista' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem', 
              maxHeight: '70vh', 
              overflowY: 'auto',
              paddingRight: '0.5rem',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--color-border) transparent'
            }}>
              {tareasListaFiltradas.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--color-surface-2)', borderRadius: '1.5rem', border: '1px dashed var(--color-border)', color: 'var(--color-text-dim)' }}>
                  <Search size={40} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                  <p style={{ fontWeight: '700' }}>{t('projectNoTasksFound')}</p>
                </div>
              ) : (
                tareasListaFiltradas.slice(0, limite).map(t => (
                  <TareaCard 
                    key={t.id} 
                    tarea={t} 
                    usuarioActual={usuario}
                    onClick={(x) => { setTareaEditando(x); setModal(true); }}
                    onEliminar={handleEliminar}
                    onCambiarEstado={handleCambiarEstado}
                  />
                ))
              )}
            </div>
            
            {tareasListaFiltradas.length > limite && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button 
                  onClick={() => setLimite(prev => prev + 10)}
                  className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm uppercase tracking-widest flex items-center gap-2"
                >
                  {t('projectLoadMoreTasks', { count: tareasFiltradasAvanzadas.length - limite })} <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        )}
        {vista === 'kanban' && <KanbanView tareas={tareasFiltradasAvanzadas} onClick={(x) => { setTareaEditando(x); setModal(true); }} onEliminar={handleEliminar} onCambiarEstado={handleCambiarEstado} onEditar={(x) => { setTareaEditando(x); setModal(true); }} onActualizarTarea={handleActualizarTarea} />}
        {vista === 'gantt' && <GanttView proyecto={proyecto} tareas={tareasFiltradasAvanzadas} />}
      </div>

      {/* Modales */}
      {modal && (
        <ModalTarea 
          tarea={tareaEditando} 
          proyectoId={id} 
          usuarioActual={usuario}
          usuarios={usuarios} 
          onClose={cerrarModalTarea} 
          onGuardar={handleGuardarTarea} 
          onTareaMutada={handleSincronizarTarea}
          onEliminar={handleEliminar}
        />
      )}
      {modalImportar && (
        <ModalImportar 
          proyectoId={id} 
          usuarios={usuarios} 
          usuarioActual={usuario}
          onClose={() => setModalImportar(false)} 
          onImportado={handleImportado} 
        />
      )}
      {modalExportar && (
        <ModalExportarProyecto
          proyecto={proyecto}
          onClose={() => setModalExportar(false)}
          onExportar={handleExportar}
        />
      )}
      {modalPlantilla && (
        <ModalGuardarPlantilla
          proyecto={proyecto}
          onClose={() => setModalPlantilla(false)}
          onGuardar={handleGuardarPlantilla}
        />
      )}
    </div>
  );
};

// ── Modal de Tarea (Simplified & Professional) ──────────────────────────────
const ModalTarea = ({ tarea, proyectoId, usuarioActual, usuarios, onClose, onGuardar, onTareaMutada, onEliminar }) => {
  const { t } = usePreferences();
  const creadorEsUsuarioActual = tarea?.creador?.id === usuarioActual?.id
    || (!tarea?.creador?.id && (getTaskAssignees(tarea).length === 0 || isTaskAssignedToUser(tarea, usuarioActual?.id)));
  const [form, setForm] = useState({
    titulo: tarea?.titulo || '',
    descripcion: tarea?.descripcion || '',
    numeroActividad: tarea?.numeroActividad || '',
    asignadoIds: getTaskAssignees(tarea).map((asignado) => asignado.id),
    prioridad: tarea?.prioridad || 'MEDIA',
    estado: tarea?.estado || 'PENDIENTE',
    maquinaId: tarea?.maquinaId ?? '',
    fechaInicio: tarea?.fechaInicio ? tarea.fechaInicio.slice(0,10) : new Date().toISOString().slice(0,10),
    venceEn: tarea?.venceEn ? tarea.venceEn.slice(0,10) : ''
  });
  const [cargando, setCargando] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);

  // El catálogo de máquinas para el selector. Si falla no se bloquea la tarea:
  // vincular una máquina es opcional.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { maquinas: lista } = await maquinasService.listar();
        if (vivo) setMaquinas(lista);
      } catch { /* el selector queda vacío, la tarea se guarda igual */ }
    })();
    return () => { vivo = false; };
  }, []);

  const sincronizarTarea = useCallback((cambios = {}) => {
    if (!tarea?.id) return;
    onTareaMutada?.(tarea.id, cambios);
  }, [onTareaMutada, tarea?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      if (tarea) {
        const response = await tareasService.editar(tarea.id, form);
        onGuardar({ tarea: response.tarea, creada: false });
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k,v]) => {
          if (k === 'asignadoIds') {
            fd.append(k, JSON.stringify(v));
            return;
          }
          fd.append(k,v);
        });
        archivos.forEach((file) => fd.append('archivos', file));
        const response = await tareasService.crear(proyectoId, fd);
        onGuardar({ tarea: response.tarea, creada: true });
      }
    } catch (err) { alert(err.message); }
    finally { setCargando(false); }
  };

  return (
    <div 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-end lg:items-center justify-center p-0 lg:p-4 transition-all"
    >
      <div className="bg-[var(--color-surface)] w-full max-w-2xl rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] lg:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10">
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-3)]">
          <h2 className="text-xl lg:text-2xl font-black text-[var(--color-text)] tracking-tight">{tarea ? t('taskEditTitle') : t('taskNewTitle')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors border border-transparent hover:border-slate-100">
            <Zap size={20} className="rotate-45" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskTitle').toUpperCase()}</label>
              <input
                className="form-input"
                value={form.titulo}
                onChange={e => setForm({...form, titulo: e.target.value})}
                required
                placeholder={t('taskTitlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskDescription').toUpperCase()}</label>
              <textarea
                className="form-input resize-none"
                rows="3"
                value={form.descripcion}
                onChange={e => setForm({...form, descripcion: e.target.value})}
                placeholder={t('taskDescriptionPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskActivityNumber').toUpperCase()}</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={form.numeroActividad}
                onChange={e => setForm({ ...form, numeroActividad: e.target.value })}
                placeholder={t('taskActivityPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskAssignedTo').toUpperCase()}</label>
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <div className="flex flex-wrap gap-2">
                    {usuarios.map((u) => {
                      const isSelected = form.asignadoIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setForm((prev) => ({
                            ...prev,
                            asignadoIds: isSelected
                              ? prev.asignadoIds.filter((idAsignado) => idAsignado !== u.id)
                              : [...prev.asignadoIds, u.id],
                          }))}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${isSelected ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/20' : 'bg-white text-[var(--color-text-dim)] border-[var(--color-border)] hover:bg-[var(--color-surface-3)]'}`}
                        >
                          {u.nombre}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-[var(--color-text-muted)]">
                    {form.asignadoIds.length > 0
                      ? `${form.asignadoIds.length} ${form.asignadoIds.length === 1 ? 'responsable seleccionado' : 'responsables seleccionados'}`
                      : t('taskUnassigned')}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskStatus').toUpperCase()}</label>
                <select className="form-input form-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  {ESTADOS_TAREA.map(e => <option key={e.value} value={e.value}>{t(e.labelKey)}</option>)}
                </select>
              </div>
            </div>

            {(tarea?.creador?.nombre || creadorEsUsuarioActual) && (
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs font-black uppercase tracking-widest text-brand-700">
                {creadorEsUsuarioActual ? t('taskCreatedByYou') : `${t('taskAssignedBy')} ${tarea.creador.nombre}`}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                {t('taskMachine').toUpperCase()}
              </label>
              <select
                className="form-input form-select"
                value={form.maquinaId}
                onChange={e => setForm({ ...form, maquinaId: e.target.value })}
              >
                <option value="">{t('taskNoMachine')}</option>
                {maquinas.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} — {m.tipo}{m.disponible ? '' : ' (ocupada)'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                {t('taskMachineHint')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskPriority').toUpperCase()}</label>
                <select className="form-input form-select" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}>
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskDuration').toUpperCase()}</label>
                <RangeDatePicker 
                  from={form.fechaInicio ? new Date(form.fechaInicio + 'T12:00:00') : null}
                  to={form.venceEn ? new Date(form.venceEn + 'T12:00:00') : null}
                  onChange={(range) => {
                    setForm({
                      ...form,
                      fechaInicio: range?.from ? range.from.toISOString().slice(0, 10) : '',
                      venceEn: range?.to ? range.to.toISOString().slice(0, 10) : ''
                    });
                  }}
                />
              </div>
            </div>

            <TaskAttachments
              tareaId={tarea?.id}
              type="tareas"
              title={t('taskSupportDocuments')}
              pendingFiles={archivos}
              onPendingFilesChange={setArchivos}
              onAttachmentsChange={(adjuntos) => sincronizarTarea({ adjuntos })}
              showUploader
              showExisting={Boolean(tarea?.id)}
              uploadLabel={tarea ? t('taskAddFiles') : t('taskSelectFiles')}
            />
          </form>

          {tarea?.id && (
            <div className="mt-8 border-t border-[var(--color-border)] pt-6">
              <TaskComments
                tareaId={tarea.id}
                type="tareas"
                onCommentsChange={(comentarios) => sincronizarTarea({ comentarios })}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 border-t border-[var(--color-border)] bg-[var(--color-surface-3)] flex flex-col-reverse lg:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all uppercase tracking-widest"
          >
            {t('cancel')}
          </button>
          {tarea && (
            <button
              type="button"
              onClick={() => { onEliminar(tarea); onClose(); }}
              className="flex-1 px-6 py-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-all"
            >
              {t('delete')}
            </button>
          )}
          <button onClick={handleSubmit} className="flex-[2] px-6 py-4 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50" disabled={cargando}>
            {cargando ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ModalExportarProyecto = ({ proyecto, onClose, onExportar }) => {
  const { t } = usePreferences();
  return (
  <div
    onClick={(e) => e.target === e.currentTarget && onClose()}
    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-end lg:items-center justify-center p-0 lg:p-4"
  >
    <div className="bg-[var(--color-surface)] w-full max-w-md rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden">
      <div className="px-8 py-6 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
        <h2 className="text-xl font-black text-[var(--color-text)]">{t('taskExportTitle')}</h2>
        <p className="text-sm text-[var(--color-text-muted)] font-medium mt-1">{proyecto?.nombre}</p>
      </div>
      <div className="px-8 py-6 space-y-3">
        <button
          onClick={() => onExportar('excel')}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-3)] transition-all"
        >
          <span className="flex items-center gap-3 text-sm font-black text-[var(--color-text)]"><FileSpreadsheet size={18} /> Excel</span>
          <span className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest">.xlsx</span>
        </button>
        <button
          onClick={() => onExportar('json')}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-3)] transition-all"
        >
          <span className="flex items-center gap-3 text-sm font-black text-[var(--color-text)]"><FileJson size={18} /> JSON</span>
          <span className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest">.json</span>
        </button>
      </div>
      <div className="px-8 py-5 border-t border-[var(--color-border)] bg-[var(--color-surface-3)]">
        <button onClick={onClose} className="w-full px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-all">
          {t('close')}
        </button>
      </div>
    </div>
  </div>
  );
};

const ModalGuardarPlantilla = ({ proyecto, onClose, onGuardar }) => {
  const { t } = usePreferences();
  const [form, setForm] = useState({
    nombre: t('taskTemplateDefaultName', { project: proyecto?.nombre || t('projects') }),
    descripcion: proyecto?.descripcion || '',
  });
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar(form);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-end lg:items-center justify-center p-0 lg:p-4"
    >
      <div className="bg-[var(--color-surface)] w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-8 py-6 border-b border-[var(--color-border)] bg-[var(--color-surface-3)]">
          <h2 className="text-xl font-black text-[var(--color-text)]">{t('projectSaveTemplate')}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldName')}</label>
            <input
              className="form-input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskDescription')}</label>
            <input
              className="form-input"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          <div className="flex flex-col-reverse lg:flex-row gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-all uppercase tracking-widest">
              {t('cancel')}
            </button>
            <button type="submit" disabled={guardando} className="flex-[2] px-6 py-4 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20">
              {guardando ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProyectoDetallePage;
