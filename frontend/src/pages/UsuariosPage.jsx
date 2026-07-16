// Página de Gestión de Usuarios (Solo Admin)
import { Fragment, useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'react-router-dom';
import { proyectosService, tareasService, usuariosService, statsService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { PageSkeleton } from '../components/Skeleton';
import { 
  Pencil, 
  Trash2, 
  UserPlus,
  Mail,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCcw,
  UserX,
  UserCheck,
  Activity,
  CalendarDays,
  PlayCircle,
  ChevronDown,
  Ban
} from 'lucide-react';

const AREAS = ['VENTAS', 'ALMACEN', 'COMPRAS', 'ADMINISTRACION', 'RENTA', 'TALLER'];
const ROLES = ['MIEMBRO', 'ADMIN'];

const actividadVacia = () => ({
  hechasHoy: [],
  enProgreso: [],
  faltanHoy: [],
  faltanSemana: [],
  totales: {
    hechasHoy: 0,
    enProgreso: 0,
    faltanHoy: 0,
    faltanSemana: 0
  }
});

const ordenarPorFecha = (a, b) => {
  if (!a.venceEn && !b.venceEn) return a.titulo.localeCompare(b.titulo);
  if (!a.venceEn) return 1;
  if (!b.venceEn) return -1;
  return new Date(a.venceEn) - new Date(b.venceEn);
};

const actividadDesdeTareas = (usuarioId, tareas) => {
  const usuarioTareas = tareas.filter(t => t.asignadoId === usuarioId || t.creadorId === usuarioId);
  const actividad = actividadVacia();

  actividad.hechasHoy = usuarioTareas.filter(t => t.estado === 'HECHO').sort(ordenarPorFecha);
  actividad.enProgreso = usuarioTareas.filter(t => t.estado === 'EN_PROGRESO').sort(ordenarPorFecha);
  actividad.faltanHoy = usuarioTareas.filter(t => t.estado === 'PENDIENTE').sort(ordenarPorFecha);
  actividad.faltanSemana = usuarioTareas.filter(t => t.estado !== 'HECHO' && t.venceEn).sort(ordenarPorFecha);
  actividad.porProyecto = [...usuarioTareas.reduce((acc, tarea) => {
    const id = tarea.proyecto?.id || 'sin-proyecto';
    const actual = acc.get(id) || {
      id,
      nombre: tarea.proyecto?.nombre || 'Sin proyecto',
      total: 0,
      hechas: 0,
      enProgreso: 0,
      pendientes: 0
    };

    actual.total += 1;
    if (tarea.estado === 'HECHO') actual.hechas += 1;
    if (tarea.estado === 'EN_PROGRESO') actual.enProgreso += 1;
    if (tarea.estado === 'PENDIENTE') actual.pendientes += 1;
    acc.set(id, actual);
    return acc;
  }, new Map()).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  actividad.totales = {
    hechasHoy: actividad.hechasHoy.length,
    enProgreso: actividad.enProgreso.length,
    faltanHoy: actividad.faltanHoy.length,
    faltanSemana: actividad.faltanSemana.length
  };

  return actividad;
};

const getLocale = () => document.documentElement.lang === 'en' ? 'en-US' : 'es-MX';
const TaskMini = ({ tarea }) => (
  <div className="py-2 border-b border-slate-100 last:border-0">
    <div className="text-xs font-black text-slate-800 leading-snug">{tarea.titulo}</div>
    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
      <span className="truncate">{tarea.proyecto?.nombre || ''}</span>
      {tarea.venceEn && <span className="shrink-0">{new Date(tarea.venceEn).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' })}</span>}
    </div>
  </div>
);

const ActivityColumn = ({ title, count, icon, color, items, empty }) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color }}>
        {icon}
        {title}
      </div>
      <span className="text-xs font-black" style={{ color }}>{count}</span>
    </div>
    <div className="bg-white rounded-xl border border-slate-100 px-3 py-1 min-h-[58px]">
      {items?.length ? items.map(t => <TaskMini key={t.id} tarea={t} />) : (
        <div className="h-11 flex items-center text-[11px] font-bold text-slate-400">{empty}</div>
      )}
    </div>
  </div>
);

const ProjectSummary = ({ proyectos }) => {
  const { t } = usePreferences();
  if (!proyectos?.length) return null;

  return (
    <div className="lg:col-span-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">{t('usersActivityByProject')}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {proyectos.map(p => (
          <div key={p.id} className="rounded-lg bg-[var(--color-surface-3)] border border-[var(--color-border)] px-3 py-2">
            <div className="text-xs font-black text-[var(--color-text)] truncate">{p.nombre}</div>
            <div className="mt-1 text-[10px] font-bold text-[var(--color-text-muted)]">
              {p.total} · {p.hechas} {t('usersActivityDone').toLowerCase()} · {p.enProgreso} {t('projectInProgress').toLowerCase()} · {p.pendientes}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const UserActivityPanel = ({ actividad }) => {
  const { t } = usePreferences();
  if (!actividad) {
    return <div className="text-xs font-bold text-[var(--color-text-muted)]">{t('usersNoActivityData')}</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      <ProjectSummary proyectos={actividad.porProyecto} />
      <ActivityColumn
        title={t('usersActivityDone')}
        count={actividad.totales?.hechasHoy || 0}
        color="#16a34a"
        icon={<CheckCircle2 size={13} />}
        items={actividad.hechasHoy}
        empty={t('usersActivityNoDone')}
      />
      <ActivityColumn
        title={t('usersActivityDoing')}
        count={actividad.totales?.enProgreso || 0}
        color="var(--color-primary)"
        icon={<PlayCircle size={13} />}
        items={actividad.enProgreso}
        empty={t('usersActivityNoCurrent')}
      />
      <ActivityColumn
        title={t('usersActivityDueToday')}
        count={actividad.totales?.faltanHoy || 0}
        color="#dc2626"
        icon={<Clock size={13} />}
        items={actividad.faltanHoy}
        empty={t('usersActivityNoDue')}
      />
      <ActivityColumn
        title={t('usersActivityDueWeek')}
        count={actividad.totales?.faltanSemana || 0}
        color="#f59e0b"
        icon={<CalendarDays size={13} />}
        items={actividad.faltanSemana}
        empty={t('usersActivityNoDueWeek')}
      />
    </div>
  );
};

const UsuariosPage = () => {
  const { t } = usePreferences();
  const { usuario: usuarioActual } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('activos');
  const [usuarios, setUsuarios] = useState([]);
  const [invitaciones, setInvitaciones] = useState([]);
  const [modalInvitar, setModalInvitar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const { showToast } = useToast();
  const actividadParam = searchParams.get('actividad');

  const { 
    data: listado, 
    error, 
    isLoading, 
    mutate 
  } = useSWR(
    tab === 'activos' ? 'usuarios' : 'invitaciones',
    async (key) => {
      if (key === 'usuarios') {
        const res = await usuariosService.listar();
        return res.usuarios || [];
      } else {
        return await usuariosService.listarInvitaciones();
      }
    },
    { 
      revalidateOnFocus: false,
      dedupingInterval: 5000 
    }
  );

  useEffect(() => {
    if (tab === 'activos') {
      setUsuarios(listado || []);
    } else {
      setInvitaciones(listado || []);
    }
  }, [listado, tab]);

  useEffect(() => {
    if (error) showToast(error.message, 'error');
  }, [error, showToast]);

  const handleEliminar = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    try {
      await usuariosService.eliminar(id);
      mutate();
      showToast('Usuario eliminado', 'success');
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleToggleEstado = async (u) => {
    const nuevoEstado = u.estado === 'activo' ? 'inactivo' : 'activo';
    const msg = nuevoEstado === 'activo' ? 'activado' : 'desactivado';
    try {
      await usuariosService.toggleEstado(u.id, nuevoEstado);
      mutate();
      showToast(`Usuario ${msg}`, 'success');
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleReenviarInvitacion = async (email) => {
    try {
      await usuariosService.reenviarInvitacion(email);
      showToast('Invitación reenviada', 'success');
      mutate();
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleEliminarInvitacion = async (invitacion) => {
    if (invitacion.estado === 'aceptada') {
      showToast('Las invitaciones aceptadas se conservan como historial', 'error');
      return;
    }

    if (!confirm(`¿Eliminar la invitación de ${invitacion.nombre}?`)) return;

    try {
      await usuariosService.eliminarInvitacion(invitacion.id);
      showToast('Invitación eliminada', 'success');
      mutate();
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleCargarActividad = async (id) => {
    try {
      const data = await usuariosService.actividad(id);
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, actividad: data.actividad } : u));
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (isLoading && (usuarios.length === 0 && invitaciones.length === 0)) return <PageSkeleton cards={4} />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-[var(--color-text)] tracking-tight">{t('usersManageTitle')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('usersManageSubtitle')}</p>
        </div>
        <button 
          onClick={() => setModalInvitar(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl md:rounded-2xl font-bold shadow-lg shadow-brand-200 transition-all active:scale-95"
        >
          <UserPlus size={18} />
          <span className="text-sm">{t('usersInvite')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setTab('activos')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === 'activos' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('usersActiveMembers')}
        </button>
        <button 
          onClick={() => setTab('invitaciones')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === 'invitaciones' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('usersInvitationsTab')}
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {tab === 'activos' ? (
          <TablaActivos 
            usuarios={usuarios} 
            onEdit={(u) => { setUsuarioEditando(u); setModalEditar(true); }}
            onDelete={handleEliminar}
            onToggleStatus={handleToggleEstado}
            onLoadActivity={handleCargarActividad}
            actividadInicialId={actividadParam ? Number(actividadParam) : null}
            onActividadInicialConsumida={() => setSearchParams({}, { replace: true })}
          />
        ) : (
          <TablaInvitaciones 
            invitaciones={invitaciones} 
            onResend={handleReenviarInvitacion}
            onDelete={handleEliminarInvitacion}
          />
        )}
      </div>

      {/* Modales */}
      {modalInvitar && (
        <ModalInvitar 
          usuarioActual={usuarioActual}
          onClose={() => setModalInvitar(false)} 
          onSuccess={() => { setModalInvitar(false); setTab('invitaciones'); mutate(); }}
        />
      )}

      {modalEditar && (
        <ModalEditar 
          usuarioActual={usuarioActual}
          usuario={usuarioEditando}
          onClose={() => { setModalEditar(false); setUsuarioEditando(null); }} 
          onSuccess={() => { setModalEditar(false); setUsuarioEditando(null); mutate(); }}
        />
      )}
    </div>
  );
};

const TablaActivos = ({ usuarios, onEdit, onDelete, onToggleStatus, onLoadActivity, actividadInicialId, onActividadInicialConsumida }) => {
  const { t } = usePreferences();
  const [actividadAbierta, setActividadAbierta] = useState(null);

  useEffect(() => {
    if (!actividadInicialId || actividadAbierta === actividadInicialId) return;
    const usuarioExiste = usuarios.some((usuario) => usuario.id === actividadInicialId);
    if (!usuarioExiste) return;

    const abrir = async () => {
      await onLoadActivity(actividadInicialId);
      setActividadAbierta(actividadInicialId);
      onActividadInicialConsumida?.();
    };

    abrir();
  }, [actividadInicialId, actividadAbierta, usuarios, onLoadActivity, onActividadInicialConsumida]);

  if (usuarios.length === 0) return <div className="p-12 text-center text-[var(--color-text-muted)]">{t('usersNoActiveMembers')}</div>;

  return (
    <div className="overflow-x-auto">
      {/* Desktop Table View */}
      <table className="hidden md:table w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableMember')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableArea')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableRole')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableRegister')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableStatus')}</th>
            <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {usuarios.map(u => (
            <Fragment key={u.id}>
            <tr className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{u.nombre}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
                  {u.area}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg border ${
                  u.rol === 'ADMIN' ? 'bg-accent-50 text-accent-700 border-accent-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {u.rol}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                {new Date(u.creadoEn).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${u.estado === 'activo' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${u.estado === 'activo' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  {u.estado === 'activo' ? t('usersStatusActive') : t('usersStatusInactive')}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={async () => {
                      if (actividadAbierta !== u.id) await onLoadActivity(u.id);
                      setActividadAbierta(prev => prev === u.id ? null : u.id);
                    }}
                    title="Ver actividad"
                    className={`p-2 rounded-xl transition-all ${actividadAbierta === u.id ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'}`}
                  >
                    <Activity size={18} />
                  </button>
                  <button 
                    onClick={() => onToggleStatus(u)}
                    title={u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                    className={`p-2 rounded-xl transition-all ${u.estado === 'activo' ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                  >
                    {u.estado === 'activo' ? <UserX size={18} /> : <UserCheck size={18} />}
                  </button>
                  <button 
                    onClick={() => onEdit(u)}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => onDelete(u.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
            {actividadAbierta === u.id && (
              <tr key={`${u.id}-actividad`} className="bg-slate-50/70">
                <td colSpan={6} className="px-6 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{t('usersActivityOf', { name: u.nombre })}</div>
                    <button
                      onClick={() => setActividadAbierta(null)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700"
                    >
                      {t('close')} <ChevronDown size={13} className="rotate-180" />
                    </button>
                  </div>
                  <UserActivityPanel actividad={u.actividad} />
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4 p-4">
        {usuarios.map(u => (
          <div key={u.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-slate-900">{u.nombre}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{u.email}</div>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                u.rol === 'ADMIN' ? 'bg-accent-50 text-accent-700 border-accent-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                {u.rol}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-200/50">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('usersTableArea')}</span>
                <span className="text-xs font-bold text-slate-700">{u.area}</span>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('usersTableStatus')}</span>
                <span className={`text-xs font-black uppercase ${u.estado === 'activo' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {u.estado}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-slate-400 font-medium italic">
                {t('usersRegShort')} {new Date(u.creadoEn).toLocaleDateString(getLocale())}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onToggleStatus(u)}
                  className={`p-2.5 rounded-xl border transition-all ${u.estado === 'activo' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}
                >
                  {u.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                </button>
                <button 
                  onClick={() => onEdit(u)}
                  className="p-2.5 bg-brand-50 text-brand-600 border border-brand-100 rounded-xl"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => onDelete(u.id)}
                  className="p-2.5 bg-red-50 text-red-500 border border-red-100 rounded-xl"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200/50">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                <Activity size={13} /> {t('usersActivity')}
              </div>
              <UserActivityPanel actividad={u.actividad} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TablaInvitaciones = ({ invitaciones, onResend, onDelete }) => {
  const { t } = usePreferences();
  if (invitaciones.length === 0) return <div className="p-12 text-center text-[var(--color-text-muted)]">{t('usersNoResults')}</div>;

  return (
    <div className="overflow-x-auto">
      {/* Desktop Table View */}
      <table className="hidden md:table w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableMember')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableArea')} / {t('usersTableRole')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableStatus')}</th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableRegister')}</th>
            <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-wider">{t('usersTableActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invitaciones.map(inv => (
            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{inv.nombre}</div>
                    <div className="text-xs text-slate-400">{inv.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                   <span className="text-[9px] font-bold text-slate-500 uppercase">{inv.area}</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase">{inv.rol}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                {inv.estado === 'pendiente' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600 text-xs font-bold border border-brand-100">
                    <Clock size={12} /> {t('usersStatusPending')}
                  </span>
                )}
                {inv.estado === 'aceptada' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                    <CheckCircle2 size={12} /> {t('usersStatusAccepted')}
                  </span>
                )}
                {inv.estado === 'expirada' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                    <AlertTriangle size={12} /> Expirada
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="text-xs font-medium text-slate-500">Enviada: {new Date(inv.creadoEn).toLocaleDateString()}</div>
                <div className="text-[10px] text-slate-400">Expira: {new Date(inv.expiraEn).toLocaleDateString()}</div>
              </td>
              <td className="px-6 py-4 text-right">
                {inv.estado !== 'aceptada' && (
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => onResend(inv.email)}
                      className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RefreshCcw size={12} /> Reenviar
                    </button>
                    <button
                      onClick={() => onDelete(inv)}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Ban size={12} /> Cancelar
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4 p-4">
        {invitaciones.map(inv => (
          <div key={inv.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Mail size={18} />
              </div>
              <div className="flex-1">
                <div className="font-black text-slate-900 leading-tight">{inv.nombre}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{inv.email}</div>
              </div>
              <div className="text-right">
                {inv.estado === 'pendiente' && <div className="text-[9px] font-black text-brand-500 uppercase px-2 py-0.5 bg-brand-50 border border-brand-100 rounded-md">Pendiente</div>}
                {inv.estado === 'aceptada' && <div className="text-[9px] font-black text-emerald-500 uppercase px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">Aceptada</div>}
                {inv.estado === 'expirada' && <div className="text-[9px] font-black text-red-500 uppercase px-2 py-0.5 bg-red-50 border border-red-100 rounded-md">Expirada</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-200/50">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Área / Rol</span>
                <span className="text-[10px] font-bold text-slate-700">{inv.area} / {inv.rol}</span>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expira</span>
                <span className="text-xs font-bold text-slate-500">{new Date(inv.expiraEn).toLocaleDateString()}</span>
              </div>
            </div>

            {inv.estado !== 'aceptada' && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => onResend(inv.email)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-black text-brand-600 bg-brand-50 hover:bg-brand-100 py-3 rounded-xl transition-all border border-brand-100"
                >
                  <RefreshCcw size={14} /> Reenviar invitación
                </button>
                <button
                  onClick={() => onDelete(inv)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-black text-red-600 bg-red-50 hover:bg-red-100 py-3 rounded-xl transition-all border border-red-100"
                >
                  <Ban size={14} /> {t('usersCancelInvitation')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ModalInvitar = ({ usuarioActual, onClose, onSuccess }) => {
  const { t } = usePreferences();
  const esAdminArea = usuarioActual?.rol === 'ADMIN' && usuarioActual?.area !== 'ADMINISTRACION';
  const areasDisponibles = esAdminArea ? [usuarioActual.area] : AREAS;
  const [form, setForm] = useState({ nombre: '', email: '', area: areasDisponibles[0] || 'VENTAS', rol: 'MIEMBRO' });
  const [cargando, setCargando] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      await usuariosService.invitar(form);
      showToast('Invitación enviada');
      onSuccess();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div className="bg-[var(--color-surface)] rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-[var(--color-border)]">
        <div className="p-8 pb-0">
          <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-4">
            <Mail size={20} />
          </div>
          <h2 className="text-xl font-black text-[var(--color-text)] tracking-tight">{t('usersInviteTitle')}</h2>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">{t('usersInviteSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('usersInviteNameLabel')}</label>
            <input
              required
              className="form-input"
              value={form.nombre}
              onChange={e => setForm({...form, nombre: e.target.value})}
              placeholder={t('usersInviteNamePlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('usersInviteEmailLabel')}</label>
            <input
              required
              type="email"
              className="form-input"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              placeholder={t('usersInviteEmailPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldArea')}</label>
              <select 
                disabled={areasDisponibles.length === 1}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                value={form.area}
                onChange={e => setForm({...form, area: e.target.value})}
              >
                {areasDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldRole')}</label>
              <select
                className="form-input form-select"
                value={form.rol}
                onChange={e => setForm({...form, rol: e.target.value})}
              >
                {ROLES.map(r => <option key={r} value={r}>{t(r === 'ADMIN' ? 'roleAdmin' : 'roleMember')}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-all"
            >
              {t('cancel')}
            </button>
            <button
              disabled={cargando}
              className="flex-1.5 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all active:scale-95 disabled:bg-slate-200"
            >
              {cargando ? t('usersInviteSending') : <><Send size={18} /> {t('usersInviteSend')}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ModalEditar = ({ usuarioActual, usuario, onClose, onSuccess }) => {
  const { t } = usePreferences();
  const esAdminArea = usuarioActual?.rol === 'ADMIN' && usuarioActual?.area !== 'ADMINISTRACION';
  const areasDisponibles = esAdminArea ? [usuarioActual.area] : AREAS;
  const [form, setForm] = useState({
    nombre: usuario?.nombre || '',
    email: usuario?.email || '',
    area: usuario?.area || areasDisponibles[0] || 'VENTAS',
    rol: usuario?.rol || 'MIEMBRO'
  });
  const [cargando, setCargando] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      await usuariosService.editar(usuario.id, form);
      showToast('Usuario actualizado');
      onSuccess();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div className="bg-[var(--color-surface)] rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-[var(--color-border)]">
        <div className="p-8 pb-0">
          <h2 className="text-xl font-black text-[var(--color-text)] tracking-tight">{t('usersEditTitle')}</h2>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">{t('usersEditSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldName')}</label>
            <input
              required
              className="form-input"
              value={form.nombre}
              onChange={e => setForm({...form, nombre: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldEmail')}</label>
            <input
              required
              type="email"
              className="form-input"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldArea')}</label>
              <select
                disabled={areasDisponibles.length === 1}
                className="form-input form-select"
                value={form.area}
                onChange={e => setForm({...form, area: e.target.value})}
              >
                {areasDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('fieldRole')}</label>
              <select
                className="form-input form-select"
                value={form.rol}
                onChange={e => setForm({...form, rol: e.target.value})}
              >
                {ROLES.map(r => <option key={r} value={r}>{t(r === 'ADMIN' ? 'roleAdmin' : 'roleMember')}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 rounded-xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-all">{t('cancel')}</button>
            <button disabled={cargando} className="flex-1.5 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:bg-slate-200">
              {cargando ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UsuariosPage;
