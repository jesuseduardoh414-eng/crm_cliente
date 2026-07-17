// Tareas del panel.
//
// Son las que abre el panel de noticias: cuando alguien publica que hay una
// retro libre o convoca una junta, aquí aparece el pendiente. No pertenecen a
// ninguna obra, así que no son de nadie hasta que alguien las toma: cualquiera
// puede asignárselas y cerrarlas.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ListChecks,
  Megaphone,
  Forklift,
  HardHat,
  Info,
  CalendarClock,
  CircleDot,
  CirclePlay,
  CircleCheck,
  Clock,
  UserRound,
  Hand,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { tareasService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';
import UserAvatar from '../components/UserAvatar';

const TIPO_NOTICIA = {
  MAQUINA_RENTA: { label: 'Máquina', Icon: Forklift, clase: 'text-brand-600' },
  OPERADOR_DISPONIBLE: { label: 'Operador', Icon: HardHat, clase: 'text-emerald-600' },
  REUNION: { label: 'Reunión', Icon: CalendarClock, clase: 'text-violet-600' },
  AVISO: { label: 'Aviso', Icon: Info, clase: 'text-accent-600' },
};

const ESTADOS = [
  { k: 'PENDIENTE', label: 'Pendiente', Icon: CircleDot, clase: 'bg-slate-100 text-slate-600', activo: 'bg-slate-500 text-white border-slate-500' },
  { k: 'EN_PROGRESO', label: 'En curso', Icon: CirclePlay, clase: 'bg-blue-50 text-blue-700', activo: 'bg-blue-600 text-white border-blue-600' },
  { k: 'HECHO', label: 'Hecho', Icon: CircleCheck, clase: 'bg-emerald-50 text-emerald-700', activo: 'bg-emerald-600 text-white border-emerald-600' },
];

const PRIORIDAD_CONF = {
  ALTA: 'bg-red-50 text-red-600',
  MEDIA: 'bg-amber-50 text-amber-700',
  BAJA: 'bg-slate-100 text-slate-500',
};

const fecha = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

const esVencida = (tarea) =>
  tarea.venceEn && tarea.estado !== 'HECHO' && new Date(tarea.venceEn) < new Date();

// ── Tarjeta ────────────────────────────────────────────────────────────────
const TareaCard = ({ tarea, usuarioId, onEstado, onTomar }) => {
  const noticia = TIPO_NOTICIA[tarea.publicacion?.tipo];
  const asignados = tarea.asignados?.length ? tarea.asignados : (tarea.asignado ? [tarea.asignado] : []);
  const esMia = asignados.some((a) => a.id === usuarioId);
  const vencida = esVencida(tarea);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-5 shadow-sm hover:shadow-lg transition-all flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {noticia && (
            <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5 ${noticia.clase}`}>
              <noticia.Icon size={11} /> {noticia.label}
            </span>
          )}
          <h3 className="font-black text-[var(--color-text)] leading-tight">{tarea.titulo}</h3>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
          PRIORIDAD_CONF[tarea.prioridad] || PRIORIDAD_CONF.MEDIA
        }`}>
          {tarea.prioridad}
        </span>
      </div>

      {tarea.descripcion && (
        <p className="text-xs text-[var(--color-text-dim)] line-clamp-2">{tarea.descripcion}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold">
        {tarea.venceEn && (
          <span className={`flex items-center gap-1 ${vencida ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
            <Clock size={12} /> {vencida ? 'Venció' : 'Vence'} {fecha(tarea.venceEn)}
          </span>
        )}
        {tarea.maquina && (
          <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <Forklift size={12} /> {tarea.maquina.nombre}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {ESTADOS.map(({ k, label, Icon, activo, clase }) => (
          <button
            key={k}
            onClick={() => onEstado(tarea, k)}
            className={`flex-1 px-2 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${
              tarea.estado === k
                ? activo
                : `${clase} border-transparent opacity-50 hover:opacity-100`
            }`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between gap-2">
        {asignados.length > 0 ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-2">
              {asignados.slice(0, 3).map((a) => (
                <UserAvatar key={a.id} usuario={a} size={24} radius={999} fontSize="0.55rem" />
              ))}
            </div>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] truncate">
              {esMia ? 'Tuya' : asignados[0].nombre}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] flex items-center gap-1">
            <UserRound size={11} /> Sin asignar
          </span>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {!esMia && (
            <button
              onClick={() => onTomar(tarea)}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[9px] font-black uppercase tracking-widest text-[var(--color-text-dim)] hover:bg-[var(--color-surface-3)] flex items-center gap-1"
              title="Asignármela"
            >
              <Hand size={11} /> Tomar
            </button>
          )}
          {tarea.publicacion && (
            <Link to="/noticias" className="btn-icon-sm" title="Ver la noticia">
              <Megaphone size={13} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Página ─────────────────────────────────────────────────────────────────
const TareasPanelPage = () => {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [tareas, setTareas] = useState([]);
  const [progreso, setProgreso] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloMias, setSoloMias] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { tareas: lista, progreso: p } = await tareasService.listarPanel({
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(soloMias ? { mias: 'true' } : {}),
      });
      setTareas(lista);
      setProgreso(p);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, soloMias, showToast]);

  // Diferida como en el resto del panel: los filtros son botones y cambiarlos
  // rápido no debe disparar una petición por clic.
  useEffect(() => {
    const id = setTimeout(cargar, 150);
    return () => clearTimeout(id);
  }, [cargar]);

  const cambiarEstado = async (tarea, estado) => {
    if (tarea.estado === estado) return;
    try {
      await tareasService.actualizarEstado(tarea.id, estado);
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const tomar = async (tarea) => {
    try {
      await tareasService.editar(tarea.id, { asignadoIds: [usuario.id] });
      showToast('Tarea asignada a ti');
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (cargando && tareas.length === 0) return <PageSkeleton cards={6} />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl lg:text-5xl font-black text-[var(--color-text)] tracking-tight leading-none">
            Tareas del panel
          </h1>
          <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-medium mt-2">
            Lo que abre cada noticia. No son de ninguna obra: quien pueda, las toma.
          </p>
        </div>
        <Link to="/noticias" className="btn-primary shrink-0">
          <Megaphone size={18} /> Ir al panel
        </Link>
      </div>

      {progreso && progreso.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', valor: progreso.total, clase: 'text-[var(--color-text)]' },
            { label: 'Pendientes', valor: progreso.pendientes, clase: 'text-slate-500' },
            { label: 'En curso', valor: progreso.enProgreso, clase: 'text-blue-600' },
            { label: 'Hechas', valor: `${progreso.porcentaje}%`, clase: 'text-emerald-600' },
          ].map(({ label, valor, clase }) => (
            <div key={label} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
              <p className={`text-2xl font-black mt-1 ${clase}`}>{valor}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="flex gap-2 flex-1 flex-wrap">
          <button
            onClick={() => setFiltroEstado('')}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              filtroEstado === ''
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)]'
            }`}
          >
            Todas
          </button>
          {ESTADOS.map(({ k, label, Icon }) => (
            <button
              key={k}
              onClick={() => setFiltroEstado(k)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                filtroEstado === k
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)]'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSoloMias((v) => !v)}
          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
            soloMias
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)]'
          }`}
        >
          Solo las mías
        </button>
      </div>

      {tareas.length === 0 ? (
        <div className="text-center py-20 rounded-[24px] border border-dashed border-[var(--color-border)]">
          <ListChecks size={44} className="mx-auto text-[var(--color-text-muted)] opacity-40 mb-4" />
          <p className="font-black text-[var(--color-text)]">Nada pendiente por aquí</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {filtroEstado || soloMias
              ? 'Prueba a quitar los filtros.'
              : 'Las tareas aparecen solas cuando alguien publica una noticia en el panel.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tareas.map((t) => (
            <TareaCard
              key={t.id}
              tarea={t}
              usuarioId={usuario?.id}
              onEstado={cambiarEstado}
              onTomar={tomar}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TareasPanelPage;
