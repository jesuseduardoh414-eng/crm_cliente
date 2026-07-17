// Página de Proyectos (Material Design Premium)
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { puedeAdministrar, veTodo, administraUnArea } from '../utils/roles';
import { useToast } from '../context/ToastContext';
import { usePreferences } from '../context/PreferencesContext';
import { agendaService, proyectosService, usuariosService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';
import TaskAttachments from '../components/TaskAttachments';
import { sortProyectos } from '../utils/sorters';
import {
  ShoppingCart,
  Warehouse,
  Truck,
  Forklift,
  Wrench,
  BarChart3,
  Folder,
  Trash2, 
  Plus,
  FolderOpen, 
  ChevronRight, 
  ChevronLeft,
  Pencil,
  Upload,
  FileText,
  Calendar
} from 'lucide-react';

// ── Configuraciones Visuales ────────────────────────────────────────────────
const AREA_CONF = {
  VENTAS:         { labelKey: 'areaVentas',         color: 'var(--color-primary)', bg: 'rgb(var(--brand-600) / 0.08)', icon: <ShoppingCart size={14} /> },
  ALMACEN:        { labelKey: 'areaAlmacen',        color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   icon: <Warehouse size={14} /> },
  COMPRAS:        { labelKey: 'areaCompras',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  icon: <Truck size={14} /> },
  ADMINISTRACION: { labelKey: 'areaAdministracion', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: <BarChart3 size={14} /> },
  RENTA:          { labelKey: 'areaRenta',          color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   icon: <Forklift size={14} /> },
  TALLER:         { labelKey: 'areaTaller',         color: '#db2777', bg: 'rgba(219,39,119,0.08)',  icon: <Wrench size={14} /> },
};

const ESTADOS = [
  { value: 'ACTIVO',   labelKey: 'statusActive', color: '#00d166', bg: 'rgba(0,209,102,0.12)' },
  { value: 'EN_PAUSA', labelKey: 'statusPaused', color: '#ff9100', bg: 'rgba(255,145,0,0.12)' },
  { value: 'CERRADO',  labelKey: 'statusClosed', color: '#6c757d', bg: 'rgba(108,117,125,0.12)' },
];

const ESTADO_ALIASES = {
  PENDIENTE: 'EN_PAUSA',
  PAUSA: 'EN_PAUSA',
  PAUSADO: 'EN_PAUSA',
  TERMINADO: 'CERRADO',
  FINALIZADO: 'CERRADO',
  HECHO: 'CERRADO',
};

const normalizarEstadoProyecto = (estado) => ESTADO_ALIASES[String(estado || '').toUpperCase()] || String(estado || 'ACTIVO').toUpperCase();

const getAreasProyecto = (area) => {
  if (!area) return ['VENTAS'];
  return area.split(',').map(a => a.trim()).filter(Boolean);
};

const getLabelAreas = (area, tFn) => getAreasProyecto(area)
  .map(a => tFn ? tFn(AREA_CONF[a]?.labelKey || 'areaGeneral') : (AREA_CONF[a]?.labelKey || a))
  .join(', ');

const formatFechaCorta = (fecha, locale, t) => {
  if (!fecha) return t('projectDateNoEnd');
  return new Date(fecha).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
};

// Roles transversales: no pertenecen a un área, se muestran siempre en el
// selector de miembros. Consejo y mesa directiva.
const esRolTransversal = (usuario) => veTodo(usuario);

const dateKey = (date) => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const parseDateKey = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const monthRangeFor = (value) => {
  const base = value ? parseDateKey(value) : new Date();
  return {
    start: new Date(base.getFullYear(), base.getMonth(), 1, 12),
    end: new Date(base.getFullYear(), base.getMonth() + 1, 0, 12),
  };
};

const expandBlockedDates = (conflictos) => {
  const blocked = new Map();
  conflictos.forEach(conflicto => {
    const start = new Date(conflicto.fechaInicio);
    const end = conflicto.fechaFin ? new Date(conflicto.fechaFin) : new Date(start);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
    const maxDays = 370;
    let count = 0;
    while (cursor <= last && count < maxDays) {
      const key = dateKey(cursor);
      if (!blocked.has(key)) blocked.set(key, []);
      blocked.get(key).push(conflicto);
      cursor.setDate(cursor.getDate() + 1);
      count += 1;
    }
  });
  return blocked;
};

const esBloqueoReal = (conflicto) => conflicto.tipo !== 'proyecto';

const conflictOverlapsRange = (conflicto, startKey, endKey) => {
  if (!startKey) return false;
  const rangeStart = parseDateKey(startKey);
  const rangeEnd = parseDateKey(endKey || startKey);
  const conflictStart = new Date(conflicto.fechaInicio);
  const conflictEnd = conflicto.fechaFin ? new Date(conflicto.fechaFin) : new Date(conflictStart);
  if (Number.isNaN(conflictStart.getTime()) || Number.isNaN(conflictEnd.getTime())) return false;

  const start = new Date(conflictStart.getFullYear(), conflictStart.getMonth(), conflictStart.getDate(), 0, 0, 0, 0);
  const end = new Date(conflictEnd.getFullYear(), conflictEnd.getMonth(), conflictEnd.getDate(), 23, 59, 59, 999);
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  return start <= rangeEnd && end >= rangeStart;
};

const ProjectDatePicker = ({ label, value, onChange, blockedDates, required = false }) => {
  const { locale, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = value ? parseDateKey(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const selected = value ? parseDateKey(value) : null;
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, idx) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), idx + 1, 12)),
  ];

  const moveMonth = (delta) => {
    setVisibleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleSelect = (date) => {
    const key = dateKey(date);
    const conflicts = blockedDates.get(key) || [];
    const isHardBlocked = conflicts.some(esBloqueoReal);
    if (isHardBlocked) return;
    onChange(key);
    setOpen(false);
  };

  return (
    <div className="space-y-2 relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none flex items-center justify-between"
      >
        <span>{value ? parseDateKey(value).toLocaleDateString(locale) : 'dd/mm/aaaa'}</span>
        <Calendar size={18} className="text-slate-500" />
      </button>
      {required && !value && <input className="sr-only" required value="" onChange={() => {}} />}

      {open && (
        <div className="absolute z-[1200] mt-2 w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-slate-50 text-slate-500">
              <ChevronLeft size={18} />
            </button>
            <p className="text-xs font-black uppercase tracking-widest text-slate-900">
              {visibleMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </p>
            <button type="button" onClick={() => moveMonth(1)} className="p-2 rounded-lg hover:bg-slate-50 text-slate-500">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="h-9" />;
              const key = dateKey(date);
              const conflicts = blockedDates.get(key) || [];
              const isHardBlocked = conflicts.some(esBloqueoReal);
              const hasProjectWarning = !isHardBlocked && conflicts.some(c => c.tipo === 'proyecto');
              const isSelected = selected && dateKey(selected) === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(date)}
                  title={conflicts.length > 0 ? conflicts.map(c => `${c.usuario?.nombre || t('projectMemberLabel')}: ${c.titulo}`).join('\n') : ''}
                  disabled={isHardBlocked}
                  className={`h-9 rounded-lg text-xs font-black transition-all ${isSelected ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : isHardBlocked ? 'bg-red-50 text-red-500 border border-red-100 cursor-not-allowed opacity-80' : hasProjectWarning ? 'bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> {t('projectBlockedTask')}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-300" /> {t('projectActiveProject')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tarjeta de Proyecto ─────────────────────────────────────────────────────
const ProyectoCard = ({ proyecto, onEditar, onEliminar, onVerDetalle, esAdmin }) => {
  const { t, locale } = usePreferences();
  const areaLabel = getLabelAreas(proyecto.area, t);
  const estado = ESTADOS.find(e => e.value === normalizarEstadoProyecto(proyecto.estado)) || ESTADOS[0];
  const total = proyecto._count?.tareas || 0;
  const progresoGeneral = proyecto.progresoGeneral ?? proyecto.progreso ?? 0;
  const progresoMiembro = proyecto.progresoMiembro;

  return (
    <div 
      onClick={onVerDetalle}
      className="bg-white border border-slate-100 p-5 lg:p-6 rounded-2xl flex flex-col gap-5 hover:-translate-y-1 transition-all cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className="text-lg lg:text-xl font-black text-slate-900 truncate mb-1">{proyecto.nombre}</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ color: estado.color, background: estado.bg }}>
              {t(estado.labelKey)}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {areaLabel}
            </span>
          </div>
        </div>
        <div className="text-slate-300">
          <ChevronRight size={20} />
        </div>
      </div>

      <p className="text-sm text-slate-500 font-medium line-clamp-2 min-h-[40px]">
        {proyecto.descripcion || t('projectDefaultDescription')}
      </p>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <span className="text-slate-400">{t('projectGeneralProgress')}</span>
          <span className="text-slate-900">{progresoGeneral}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand-600 rounded-full transition-all duration-1000" 
            style={{ width: `${progresoGeneral}%` }} 
          />
        </div>
        {progresoMiembro !== null && progresoMiembro !== undefined && (
          <>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-400">{t('projectMyProgress')}</span>
              <span className="text-slate-900">{progresoMiembro}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `${progresoMiembro}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-50 mt-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
            {proyecto.creador?.nombre?.charAt(0)}
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{total} {t('projectTaskPlural').toUpperCase()}</span>
        </div>
        
        {esAdmin && (
          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onEditar(proyecto); }}
              className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100"
            >
              <Pencil size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onEliminar(proyecto); }}
              className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Modal de Proyecto ────────────────────────────────────────────────────────
const ModalProyecto = ({ proyecto, onClose, onGuardar }) => {
  const { t, locale } = usePreferences();
  const { usuario: usuarioActual } = useAuth();
  const esAdminArea = administraUnArea(usuarioActual);
  const areasIniciales = proyecto?.area ? getAreasProyecto(proyecto.area) : [usuarioActual?.area || 'VENTAS'];
  const [form, setForm] = useState({
    nombre: proyecto?.nombre || '',
    descripcion: proyecto?.descripcion || '',
    estado: proyecto?.estado || 'ACTIVO',
    areas: areasIniciales,
    fechaInicio: proyecto?.fechaInicio ? proyecto.fechaInicio.slice(0, 10) : new Date().toISOString().slice(0, 10),
    fechaFin: proyecto?.fechaFin ? proyecto.fechaFin.slice(0, 10) : '',
    miembrosIds: proyecto?.miembros?.filter(m => m.id !== usuarioActual?.id).map(m => m.id) || [],
    plantillaId: '',
  });
  const [usuarios, setUsuarios] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [ocupados, setOcupados] = useState({});
  const [consultandoDisponibilidad, setConsultandoDisponibilidad] = useState(false);
  const miembrosExistentes = new Set(
    (proyecto?.miembros || [])
      .filter(m => m.id !== usuarioActual?.id)
      .map(m => m.id)
  );

  useEffect(() => {
    usuariosService.listarParaProyectos().then(d => setUsuarios(d.usuarios)).catch(console.error);
    if (!proyecto) {
      proyectosService.listarPlantillas().then(d => setPlantillas(d.plantillas || [])).catch(console.error);
    }
  }, []);

  const plantillaSeleccionada = !proyecto && form.plantillaId
    ? plantillas.find(p => String(p.id) === String(form.plantillaId))
    : null;

  // Mostrar todos los usuarios, pero agrupados o resaltados por el área seleccionada
  const usuariosSeleccionables = usuarios.filter(u => u.id !== usuarioActual?.id);
  const usuariosEnAreas = esAdminArea
    ? usuariosSeleccionables
    : usuariosSeleccionables.filter(u => form.areas.includes(u.area) || esRolTransversal(u));
  const admins = usuariosSeleccionables.filter(esRolTransversal);
  const usuariosPorArea = [
    ...(esAdminArea ? Object.keys(AREA_CONF) : form.areas).map(area => ({
      area,
      usuarios: usuariosEnAreas.filter(u => u.area === area && !esRolTransversal(u)),
    })),
    ...(admins.length > 0 ? [{ area: 'DIRECCION', usuarios: admins }] : []),
  ];
  const conflictosEnAreas = usuariosEnAreas
    .filter(u => !esRolTransversal(u))
    .flatMap(u => (ocupados[u.id] || []).map(conflicto => ({ ...conflicto, usuario: u })))
    .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
  const usuariosParaBloqueo = usuariosEnAreas.filter(u =>
    form.miembrosIds.includes(u.id) && (!proyecto || !miembrosExistentes.has(u.id))
  );
  const fechasBloqueadas = expandBlockedDates(
    usuariosParaBloqueo
      .filter(u => !esRolTransversal(u))
      .flatMap(u => (ocupados[u.id] || []).map(conflicto => ({ ...conflicto, usuario: u })))
  );

  useEffect(() => {
    const consultar = async () => {
      const ids = usuariosEnAreas.map(u => u.id);
      if (ids.length === 0 || !form.fechaInicio) {
        setOcupados({});
        return;
      }

      setConsultandoDisponibilidad(true);
      try {
        const rangoMes = monthRangeFor(form.fechaInicio);
        const consultaInicio = rangoMes.start;
        const consultaFin = form.fechaFin ? parseDateKey(form.fechaFin) : new Date(rangoMes.start.getFullYear(), rangoMes.start.getMonth() + 12, 0, 23, 59, 59);
        consultaFin.setHours(23, 59, 59, 999);
        const data = await agendaService.consultarDisponibilidad({
          usuarios_ids: ids.join(','),
          inicio: consultaInicio.toISOString(),
          fin: consultaFin.toISOString(),
          excluir_proyecto_id: proyecto?.id,
        });
        const porUsuario = {};
        data.conflictos?.forEach(conflicto => {
          if (!porUsuario[conflicto.usuarioId]) porUsuario[conflicto.usuarioId] = [];
          porUsuario[conflicto.usuarioId].push(conflicto);
        });
        setOcupados(porUsuario);
      } catch (error) {
        console.error(error);
        setOcupados({});
      } finally {
        setConsultandoDisponibilidad(false);
      }
    };

    consultar();
  }, [form.areas, form.fechaInicio, form.fechaFin, usuarios, usuarioActual?.id]);

  const toggleArea = (area) => {
    if (esAdminArea) return;
    setForm(prev => {
      const exists = prev.areas.includes(area);
      const areas = exists ? prev.areas.filter(a => a !== area) : [...prev.areas, area];
      const miembrosPermitidos = usuariosSeleccionables.filter(u => areas.includes(u.area) || esRolTransversal(u)).map(u => u.id);
      return {
        ...prev,
        areas,
        miembrosIds: prev.miembrosIds.filter(id => miembrosPermitidos.includes(id)),
      };
    });
  };

  const toggleMiembro = (id) => {
    setForm(prev => {
      const exists = prev.miembrosIds.includes(id);
      if (exists) return { ...prev, miembrosIds: prev.miembrosIds.filter(x => x !== id) };
      return { ...prev, miembrosIds: [...prev.miembrosIds, id] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.areas.length === 0) {
      alert(t('projectPickArea'));
      return;
    }
    if (form.fechaFin && new Date(`${form.fechaFin}T23:59:59`) <= new Date(`${form.fechaInicio}T00:00:00`)) {
      alert(t('projectDateRangeError'));
      return;
    }
    const inicio = parseDateKey(form.fechaInicio);
    const fin = form.fechaFin ? parseDateKey(form.fechaFin) : inicio;
    const cursor = new Date(inicio);
    while (cursor <= fin) {
      const conflictosDia = fechasBloqueadas.get(dateKey(cursor)) || [];
      if (conflictosDia.some(esBloqueoReal)) {
        alert(t('projectMemberRangeConflict'));
        return;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    setCargando(true);
    try {
      const formData = new FormData();
      formData.append('nombre', form.nombre);
      formData.append('descripcion', form.descripcion);
      formData.append('estado', form.estado);
      formData.append('area', form.areas.join(','));
      formData.append('fechaInicio', form.fechaInicio);
      formData.append('fechaFin', form.fechaFin);
      formData.append('miembrosIds', JSON.stringify(form.miembrosIds));
      if (form.plantillaId) formData.append('plantillaId', form.plantillaId);
      
      archivos.forEach(file => {
        formData.append('archivos', file);
      });

      if (proyecto) await proyectosService.editar(proyecto.id, formData);
      else await proyectosService.crear(formData);
      onGuardar();
    } catch (err) { alert(err.message); }
    finally { setCargando(false); }
  };

  return (
    <div 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-end lg:items-center justify-center p-0 lg:p-4"
    >
      <div className="bg-[var(--color-surface)] w-full max-w-xl rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] lg:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10">
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-3)]">
          <h2 className="text-xl lg:text-2xl font-black text-[var(--color-text)] tracking-tight">{proyecto ? t('projectEditTitle') : t('projectNewModalTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Plus size={24} className="rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {!proyecto && (
              <div className="hidden space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projectTemplateLabel').toUpperCase()}</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none"
                  value={form.plantillaId}
                  onChange={e => {
                    const plantillaId = e.target.value;
                    const plantilla = plantillas.find(p => String(p.id) === plantillaId);
                    setForm(prev => ({
                      ...prev,
                      plantillaId,
                      descripcion: prev.descripcion || plantilla?.descripcion || '',
                      areas: prev.areas?.length ? prev.areas : getAreasProyecto(plantilla?.area),
                    }));
                  }}
                >
                  <option value="">Selecciona una plantilla (opcional)</option>
                  {plantillas.map(plantilla => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre} - {plantilla.totalTareas || plantilla._count?.tareas || plantilla.tareas?.length || 0} {t('projectTaskPlural')}
                    </option>
                  ))}
                </select>
                {!plantillaSeleccionada && (
                  <p className="text-[11px] font-bold text-slate-400">
                    Si no eliges una plantilla, el proyecto se crea vacío para que armes las tareas manualmente.
                  </p>
                )}
                {!plantillaSeleccionada && plantillas.length === 0 && (
                  <p className="text-[11px] font-bold text-orange-600">
                    Aún no hay plantillas guardadas. Primero entra a un proyecto existente y usa "Guardar Plantilla".
                  </p>
                )}
                {plantillaSeleccionada && (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                    <p className="text-xs font-black text-slate-900">{plantillaSeleccionada.nombre}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      {t('projectTemplateTasksBase', { count: plantillaSeleccionada.totalTareas || plantillaSeleccionada._count?.tareas || plantillaSeleccionada.tareas?.length || 0 })}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('projectFieldName').toUpperCase()}</label>
              <input className="form-input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required placeholder={t('projectFieldNamePlaceholder')} />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('taskDescription').toUpperCase()}</label>
              <textarea className="form-input resize-none" rows="3" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder={t('projectFieldDescPlaceholder')} />
            </div>

            {!proyecto && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('projectTemplateLabel').toUpperCase()}</label>
                <select
                  className="form-input form-select"
                  value={form.plantillaId}
                  onChange={e => {
                    const plantillaId = e.target.value;
                    const plantilla = plantillas.find(p => String(p.id) === plantillaId);
                    setForm(prev => ({
                      ...prev,
                      plantillaId,
                      descripcion: prev.descripcion || plantilla?.descripcion || '',
                      areas: prev.areas?.length ? prev.areas : getAreasProyecto(plantilla?.area),
                    }));
                  }}
                >
                  <option value="">{t('projectTemplatePlaceholder')}</option>
                  {plantillas.map(plantilla => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre} — {plantilla.totalTareas || plantilla._count?.tareas || plantilla.tareas?.length || 0} {t('projectTaskPlural')}
                    </option>
                  ))}
                </select>
                {!plantillaSeleccionada && (
                  <p className="text-[11px] font-bold text-[var(--color-text-muted)]">
                    {t('projectTemplateNoSelect')}
                  </p>
                )}
                {!plantillaSeleccionada && plantillas.length === 0 && (
                  <p className="text-[11px] font-bold text-orange-600">
                    {t('projectTemplateEmpty')}
                  </p>
                )}
                {plantillaSeleccionada && (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                    <p className="text-xs font-black text-[var(--color-text)]">{plantillaSeleccionada.nombre}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('projectFieldStatus').toUpperCase()}</label>
                <select className="form-input form-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  {ESTADOS.map(e => <option key={e.value} value={e.value}>{t(e.labelKey)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('projectFieldArea').toUpperCase()}</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.keys(AREA_CONF).map(k => {
                    const selected = form.areas.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleArea(k)}
                        disabled={esAdminArea && k !== usuarioActual?.area}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${selected ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/15' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-white'} ${esAdminArea && k !== usuarioActual?.area ? 'opacity-40 cursor-not-allowed hover:bg-slate-50' : ''}`}
                      >
                        <span>{t(AREA_CONF[k]?.labelKey || 'areaGeneral')}</span>
                        <span>{selected ? t('statusActive') : esAdminArea && k !== usuarioActual?.area ? '—' : t('add')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('projectFieldMembers').toUpperCase()}</label>
                {consultandoDisponibilidad && <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{t('projectCheckingCalendar')}</span>}
              </div>
              <div className="space-y-3">
                {usuariosPorArea.map(grupo => (
                  <div key={grupo.area} className="p-4 bg-brand-50/30 rounded-2xl border border-brand-100/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                      {grupo.area === 'DIRECCION' ? t('projectAdmins') : t(AREA_CONF[grupo.area]?.labelKey || 'areaGeneral')}
                    </p>
                    <div className="flex flex-wrap gap-2 min-h-[36px]">
                      {grupo.usuarios.length === 0 && (
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">{t('projectNoMembers')}</span>
                      )}
                      {grupo.usuarios.map(u => {
                        const isSelected = form.miembrosIds.includes(u.id);
                        const conflictos = esRolTransversal(u) ? [] : ocupados[u.id] || [];
                        const tieneProyectoActivo = conflictos.some(c => c.tipo === 'proyecto');
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleMiembro(u.id)}
                            title={conflictos.length > 0 ? t('projectHasBusyItems', { items: conflictos.map(c => c.titulo).join(', ') }) : ''}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-brand-600 text-white shadow-lg' : tieneProyectoActivo ? 'bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                          >
                            {isSelected ? `${t('projectMemberSelected')} ` : tieneProyectoActivo ? `${t('projectMemberInProject')} ` : '+ '}{u.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!proyecto && (
              <div className="hidden space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projectTemplateLabel').toUpperCase()}</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none"
                  value={form.plantillaId}
                  onChange={e => {
                    const plantillaId = e.target.value;
                    const plantilla = plantillas.find(p => String(p.id) === plantillaId);
                    setForm(prev => ({
                      ...prev,
                      plantillaId,
                      descripcion: prev.descripcion || plantilla?.descripcion || '',
                      areas: prev.areas?.length ? prev.areas : getAreasProyecto(plantilla?.area),
                    }));
                  }}
                >
                  <option value="">Selecciona una plantilla (opcional)</option>
                  {plantillas.map(plantilla => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre} - {plantilla.totalTareas || plantilla._count?.tareas || plantilla.tareas?.length || 0} {t('projectTaskPlural')}
                    </option>
                  ))}
                </select>
                {!plantillaSeleccionada && (
                  <p className="text-[11px] font-bold text-slate-400">
                    Si no eliges una plantilla, el proyecto se crea vacío para que armes las tareas manualmente.
                  </p>
                )}
                {!plantillaSeleccionada && plantillas.length === 0 && (
                  <p className="text-[11px] font-bold text-orange-600">
                    Aún no hay plantillas guardadas. Primero entra a un proyecto existente y usa "Guardar Plantilla".
                  </p>
                )}
                {plantillaSeleccionada && (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                    <p className="text-xs font-black text-slate-900">{plantillaSeleccionada.nombre}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      {t('projectTemplateTasksBase', { count: plantillaSeleccionada.totalTareas || plantillaSeleccionada._count?.tareas || plantillaSeleccionada.tareas?.length || 0 })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!proyecto && (
              <div className="hidden space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projectTemplateLabel').toUpperCase()}</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none"
                  value={form.plantillaId}
                  onChange={e => {
                    const plantillaId = e.target.value;
                    const plantilla = plantillas.find(p => String(p.id) === plantillaId);
                    setForm(prev => ({
                      ...prev,
                      plantillaId,
                      descripcion: prev.descripcion || plantilla?.descripcion || '',
                      areas: prev.areas?.length ? prev.areas : getAreasProyecto(plantilla?.area),
                    }));
                  }}
                >
                  <option value="">Selecciona una plantilla (opcional)</option>
                  {plantillas.map(plantilla => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre} - {plantilla.totalTareas || plantilla._count?.tareas || plantilla.tareas?.length || 0} {t('projectTaskPlural')}
                    </option>
                  ))}
                </select>
                {!plantillaSeleccionada && (
                  <p className="text-[11px] font-bold text-slate-400">
                    Si no eliges una plantilla, el proyecto se crea vacío para que armes las tareas manualmente.
                  </p>
                )}
                {!plantillaSeleccionada && plantillas.length === 0 && (
                  <p className="text-[11px] font-bold text-orange-600">
                    Aún no hay plantillas guardadas. Primero entra a un proyecto existente y usa "Guardar Plantilla".
                  </p>
                )}
                {plantillaSeleccionada && (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                    <p className="text-xs font-black text-slate-900">{plantillaSeleccionada.nombre}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      {t('projectTemplateTasksBase', { count: plantillaSeleccionada.totalTareas || plantillaSeleccionada._count?.tareas || plantillaSeleccionada.tareas?.length || 0 })}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProjectDatePicker
                label={t('projectStartDate').toUpperCase()}
                value={form.fechaInicio}
                onChange={fechaInicio => setForm({ ...form, fechaInicio })}
                blockedDates={fechasBloqueadas}
                required
              />
              <ProjectDatePicker
                label={t('projectEndDate').toUpperCase()}
                value={form.fechaFin}
                onChange={fechaFin => setForm({ ...form, fechaFin })}
                blockedDates={fechasBloqueadas}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('projectFieldCalendar').toUpperCase()}</label>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {usuariosEnAreas.length} {t('teamMemberPlural')}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {usuariosEnAreas.length === 0 ? (
                  <p className="text-xs font-bold text-[var(--color-text-muted)]">{t('projectAreaSelect')}</p>
                ) : conflictosEnAreas.length === 0 ? (
                  <p className="text-xs font-bold text-emerald-600">{t('projectNoConflicts')}</p>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {conflictosEnAreas.map(conflicto => (
                      <div key={`${conflicto.id}-${conflicto.usuario.id}`} className="flex items-start justify-between gap-3 rounded-xl bg-white border border-slate-100 p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate">{conflicto.titulo}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{conflicto.usuario.nombre}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-red-500">
                          {formatFechaCorta(conflicto.fechaInicio, locale, t)} - {formatFechaCorta(conflicto.fechaFin, locale, t)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {false && (
            <div className="hidden">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MIEMBROS POR AREA ({form.areas.join(', ')})</label>
                {consultandoDisponibilidad && <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">Revisando agenda...</span>}
              </div>
              <div className="flex flex-wrap gap-2 p-4 bg-brand-50/30 rounded-2xl border border-brand-100/50">
                {usuariosPorArea.flatMap(grupo => grupo.usuarios).map(u => {
                  const isSelected = form.miembrosIds.includes(u.id);
                  const conflictos = ocupados[u.id] || [];
                  const disabled = conflictos.length > 0;
                  return (
                    <button
                      key={u.id} type="button"
                      onClick={() => toggleMiembro(u.id)}
                      title={disabled ? `Ocupado: ${conflictos.map(c => c.titulo).join(', ')}` : ''}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-brand-600 text-white shadow-lg' : disabled ? 'bg-red-50 text-red-500 border border-red-100 cursor-not-allowed opacity-70' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {isSelected ? '✓ ' : '+ '}{u.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {false && (
            <div className="space-y-3">
              <label className="hidden">OTROS MIEMBROS</label>
              <div className="hidden">
                {[].map(u => {
                  const isSelected = form.miembrosIds.includes(u.id);
                  return (
                    <button
                      key={u.id} type="button"
                      onClick={() => toggleMiembro(u.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-brand-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {isSelected ? '✓ ' : '+ '}{u.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <TaskAttachments
              tareaId={proyecto?.id}
              type="proyectos"
              title={t('projectFieldDocuments')}
              pendingFiles={archivos}
              onPendingFilesChange={setArchivos}
              showUploader
              showExisting={Boolean(proyecto?.id)}
              uploadLabel={proyecto ? t('projectAddFiles') : t('projectSelectFiles')}
            />
            <div className="hidden">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DOCUMENTOS DE APOYO</label>
              <div className="relative group">
                <input 
                  type="file" multiple 
                  onChange={e => setArchivos([...archivos, ...Array.from(e.target.files)])}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="flex items-center gap-3 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-brand-400 transition-all">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-brand-500">
                    <Upload size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Haga clic para subir archivos</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">PDF, Word, Excel o Imágenes</p>
                  </div>
                </div>
              </div>
              
              {archivos.length > 0 && (
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {archivos.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-brand-500" />
                        <span className="text-[10px] font-black text-slate-600 truncate max-w-[200px]">{file.name}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setArchivos(archivos.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"
                      >
                        <Plus size={16} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-[var(--color-border)] bg-[var(--color-surface-3)] flex flex-col-reverse lg:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all"
          >
            {t('cancel')}
          </button>
          <button onClick={handleSubmit} className="flex-[2] px-6 py-4 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50" disabled={cargando}>
            {cargando ? t('saving') : t('projectSaveButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Componente Principal ─────────────────────────────────────────────────────
const ProyectosPage = () => {
  const { t } = usePreferences();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const esAdmin = puedeAdministrar(usuario);

  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('TODOS');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await proyectosService.listar();
      setProyectos(sortProyectos(data.proyectos));
    } catch (err) { showToast(err.message, 'error'); }
    finally { setCargando(false); }
  }, [showToast]);

  useEffect(() => {
    const fetch = async () => {
      await cargar();
    };
    fetch();
  }, [cargar]);

  const handleEliminar = async (p) => {
    if (!window.confirm(t('projectDeleteConfirm', { name: p.nombre }))) return;
    try {
      await proyectosService.eliminar(p.id);
      setProyectos(prev => prev.filter(x => x.id !== p.id));
      showToast(t('projectDeleted'));
    } catch (err) { showToast(err.message, 'error'); }
  };

  const filtrados = filtro === 'TODOS' ? proyectos : proyectos.filter(p => normalizarEstadoProyecto(p.estado) === filtro);

  if (cargando) return <PageSkeleton cards={3} />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-10 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6">
        <div>
          <h1 className="text-3xl lg:text-5xl font-black text-[var(--color-text)] tracking-tight leading-none mb-2">{t('projectsPageTitle')}</h1>
          <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-medium">{t('projectsPageSubtitle')}</p>
        </div>
        {esAdmin && (
          <button 
            onClick={() => { setEditando(null); setModal(true); }} 
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
          >
            <Plus size={18} /> {t('projectsNewProject')}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-10 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar">
        {['TODOS', 'ACTIVO', 'EN_PAUSA', 'CERRADO'].map(f => (
          <button
            key={f} 
            onClick={() => setFiltro(f)}
            className={`
              whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all snap-start
              ${filtro === f ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}
            `}
          >
            {f === 'TODOS' ? t('projectFilterAll') : t(ESTADOS.find(e => e.value === f)?.labelKey || 'statusActive')}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200">
            <FolderOpen size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 mb-1">{t('projectNoResultsTitle')}</h3>
            <p className="text-sm text-slate-500 font-medium">{t('projectNoResultsSubtitle')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrados.map(p => (
            <ProyectoCard 
              key={p.id} proyecto={p} esAdmin={esAdmin} 
              onEditar={(p) => { setEditando(p); setModal(true); }} 
              onEliminar={handleEliminar}
              onVerDetalle={() => navigate(`/proyectos/${p.id}`)}
            />
          ))}
        </div>
      )}

      {modal && <ModalProyecto proyecto={editando} onClose={() => setModal(false)} onGuardar={() => { setModal(false); cargar(); }} />}
    </div>
  );
};

export default ProyectosPage;
