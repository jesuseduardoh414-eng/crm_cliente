// Panel de noticias interno.
// El equipo anuncia máquinas que entran en renta, operadores que se ofrecen o
// avisos sueltos. Solo el autor (o un ADMIN) edita lo suyo.

import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Forklift,
  HardHat,
  Info,
  ImagePlus,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { publicacionesService, maquinasService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';
import UserAvatar from '../components/UserAvatar';

const TIPO_CONF = {
  MAQUINA_RENTA: { label: 'Máquina en renta', icon: <Forklift size={13} />, clase: 'bg-brand-50 text-brand-700 border-brand-200' },
  OPERADOR_DISPONIBLE: { label: 'Operador disponible', icon: <HardHat size={13} />, clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  AVISO: { label: 'Aviso', icon: <Info size={13} />, clase: 'bg-accent-50 text-accent-700 border-accent-200' },
};

const ESTADO_CONF = {
  PUBLICADA: null, // lo normal: no se anuncia
  BORRADOR: { label: 'Borrador', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  OCULTA: { label: 'Oculta', clase: 'bg-orange-50 text-orange-600 border-orange-200' },
};

const FORM_VACIO = { titulo: '', cuerpo: '', tipo: 'AVISO', maquinaId: '', estado: 'PUBLICADA' };

const fecha = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Modal ──────────────────────────────────────────────────────────────────
// Estado inicializado desde la prop en vez de sincronizado con un useEffect; el
// modal se remonta por su `key` cuando cambia la publicacion objetivo.
const formDesde = (publicacion) => (publicacion
  ? {
      titulo: publicacion.titulo || '',
      cuerpo: publicacion.cuerpo || '',
      tipo: publicacion.tipo || 'AVISO',
      maquinaId: publicacion.maquinaId ?? '',
      estado: publicacion.estado || 'PUBLICADA',
    }
  : FORM_VACIO);

const ModalPublicacion = ({ publicacion, maquinas, onCerrar, onGuardado }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => formDesde(publicacion));
  const [archivos, setArchivos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const datos = { ...form, maquinaId: form.maquinaId === '' ? null : Number(form.maquinaId) };
      const res = publicacion
        ? await publicacionesService.editar(publicacion.id, datos)
        : await publicacionesService.crear(datos);

      // Las imágenes se suben después: necesitan el id de la publicación.
      if (archivos.length > 0) {
        try {
          await publicacionesService.subirImagenes(res.publicacion.id, archivos);
        } catch (err) {
          showToast(`Publicación guardada, pero las imágenes fallaron: ${err.message}`, 'error');
          onGuardado();
          return;
        }
      }

      showToast(publicacion ? 'Publicación actualizada' : 'Publicada en el panel');
      onGuardado();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 lg:p-4">
      <div className="bg-[var(--color-surface)] w-full max-w-2xl rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-center sticky top-0 bg-[var(--color-surface)] z-10">
          <h2 className="text-xl lg:text-2xl font-black text-[var(--color-text)] tracking-tight">
            {publicacion ? 'Editar publicación' : 'Nueva publicación'}
          </h2>
          <button onClick={onCerrar} className="btn-icon-sm" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={guardar} className="p-8 space-y-5">
          <div className="form-group !mb-0">
            <label className="form-label">Tipo *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TIPO_CONF).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo: k }))}
                  className={`px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1.5 ${
                    form.tipo === k
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Título *</label>
            <input className="form-input" value={form.titulo} onChange={set('titulo')} required placeholder="Retroexcavadora disponible esta semana" />
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Contenido</label>
            <textarea className="form-input min-h-[110px]" value={form.cuerpo} onChange={set('cuerpo')} placeholder="Detalles, condiciones, a quién contactar…" />
          </div>

          {form.tipo === 'MAQUINA_RENTA' && (
            <div className="form-group !mb-0">
              <label className="form-label">Máquina asociada</label>
              <select className="form-input form-select" value={form.maquinaId} onChange={set('maquinaId')}>
                <option value="">Ninguna</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} — {m.tipo}</option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Si la enlazas, la tarjeta mostrará su foto y su precio.
              </p>
            </div>
          )}

          <div className="form-group !mb-0">
            <label className="form-label">Estado</label>
            <select className="form-input form-select" value={form.estado} onChange={set('estado')}>
              <option value="PUBLICADA">Publicada — la ve el equipo</option>
              <option value="BORRADOR">Borrador — solo tú</option>
              <option value="OCULTA">Oculta — retirada del panel</option>
            </select>
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Imágenes</label>
            <label className="flex items-center justify-center gap-2 w-full py-6 rounded-2xl border-2 border-dashed border-[var(--color-border)] cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all">
              <ImagePlus size={18} className="text-brand-600" />
              <span className="text-xs font-bold text-[var(--color-text-dim)]">
                {archivos.length > 0 ? `${archivos.length} imagen(es) seleccionada(s)` : 'Elegir imágenes (máx. 8)'}
              </span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setArchivos(Array.from(e.target.files || []))} />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary flex-[1.4] py-4 text-xs uppercase tracking-widest">
              {guardando ? 'Guardando…' : publicacion ? 'Guardar cambios' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Tarjeta ────────────────────────────────────────────────────────────────
const PublicacionCard = ({ publicacion, puedeEditar, onEditar, onEliminar }) => {
  const tipo = TIPO_CONF[publicacion.tipo] || TIPO_CONF.AVISO;
  const estado = ESTADO_CONF[publicacion.estado];
  const imagen = publicacion.adjuntos?.[0] || publicacion.maquina?.adjuntos?.[0];

  return (
    <article className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col">
      {imagen && (
        <div className="h-40 bg-[var(--color-surface-3)]">
          <img src={imagen.url} alt={publicacion.titulo} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${tipo.clase}`}>
            {tipo.icon} {tipo.label}
          </span>
          {estado && (
            <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${estado.clase}`}>
              {estado.label}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-black text-[var(--color-text)] leading-tight">{publicacion.titulo}</h3>
          {publicacion.cuerpo && (
            <p className="text-xs text-[var(--color-text-dim)] mt-1.5 line-clamp-3">{publicacion.cuerpo}</p>
          )}
        </div>

        {publicacion.maquina && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Máquina</p>
            <p className="text-xs font-black text-[var(--color-text)] mt-0.5">{publicacion.maquina.nombre}</p>
            {publicacion.maquina.precioDia != null && (
              <p className="text-[11px] font-bold text-brand-600 mt-0.5">
                ${Number(publicacion.maquina.precioDia).toLocaleString('es-MX')} / día
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar usuario={publicacion.autor} size={26} radius={999} fontSize="0.6rem" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-[var(--color-text)] truncate">{publicacion.autor?.nombre}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{fecha(publicacion.creadoEn)}</p>
            </div>
          </div>
          {puedeEditar && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => onEditar(publicacion)} className="btn-icon-sm" title="Editar"><Pencil size={13} /></button>
              <button onClick={() => onEliminar(publicacion)} className="btn-icon-sm hover:!text-red-500 hover:!border-red-200" title="Eliminar"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

// ── Página ─────────────────────────────────────────────────────────────────
const PanelNoticiasPage = () => {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [publicaciones, setPublicaciones] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modal, setModal] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { publicaciones: lista } = await publicacionesService.listar({ q: busqueda, tipo: filtroTipo });
      setPublicaciones(lista);
      try {
        const { maquinas: m } = await maquinasService.listar();
        setMaquinas(m);
      } catch { /* el selector de máquinas no es crítico */ }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroTipo, showToast]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const puedeEditar = (p) => usuario?.rol === 'ADMIN' || p.autorId === usuario?.id;

  const eliminar = async (publicacion) => {
    if (!window.confirm(`¿Eliminar "${publicacion.titulo}"?`)) return;
    try {
      await publicacionesService.eliminar(publicacion.id);
      showToast('Publicación eliminada');
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (cargando && publicaciones.length === 0) return <PageSkeleton cards={6} />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl lg:text-5xl font-black text-[var(--color-text)] tracking-tight leading-none">
            Panel de noticias
          </h1>
          <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-medium mt-2 flex items-center gap-1.5">
            <Lock size={13} /> Interno — solo lo ve el equipo
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary shrink-0">
          <Plus size={18} /> Nueva publicación
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input className="form-input !pl-10" placeholder="Buscar en el panel…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <select className="form-input form-select lg:w-60" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {publicaciones.length === 0 ? (
        <div className="text-center py-20 rounded-[24px] border border-dashed border-[var(--color-border)]">
          <Megaphone size={44} className="mx-auto text-[var(--color-text-muted)] opacity-40 mb-4" />
          <p className="font-black text-[var(--color-text)]">El panel está vacío</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {busqueda || filtroTipo ? 'Prueba a quitar los filtros.' : 'Publica lo primero con el botón de arriba.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {publicaciones.map((p) => (
            <PublicacionCard
              key={p.id}
              publicacion={p}
              puedeEditar={puedeEditar(p)}
              onEditar={(x) => setModal({ publicacion: x })}
              onEliminar={eliminar}
            />
          ))}
        </div>
      )}

      {modal && (
        <ModalPublicacion
          key={modal.publicacion?.id ?? 'nueva'}
          publicacion={modal.publicacion}
          maquinas={maquinas}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
};

export default PanelNoticiasPage;
