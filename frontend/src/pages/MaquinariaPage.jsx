// Catálogo de maquinaria en renta.
// Cualquiera con sesión consulta; solo el propietario (o un ADMIN) edita lo suyo.

import { useState, useEffect, useCallback } from 'react';
import {
  Forklift,
  Plus,
  Search,
  Pencil,
  Trash2,
  ImagePlus,
  ClipboardList,
  X,
  MapPin,
  CircleDot,
  Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { puedeAdministrar } from '../utils/roles';
import { useToast } from '../context/ToastContext';
import { maquinasService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';

const ESTADO_CONF = {
  PUBLICADA: { label: 'Publicada', clase: 'bg-brand-50 text-brand-700 border-brand-200' },
  BORRADOR: { label: 'Borrador', clase: 'bg-slate-100 text-slate-600 border-slate-200' },
  OCULTA: { label: 'Oculta', clase: 'bg-orange-50 text-orange-600 border-orange-200' },
};

const formatoPrecio = (valor) => {
  if (valor === null || valor === undefined) return 'Sin precio';
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2 })} / día`;
};

const FORM_VACIO = {
  nombre: '', tipo: '', marca: '', modelo: '', anio: '',
  descripcion: '', precioDia: '', ubicacion: '', estado: 'PUBLICADA',
};

// ── Modal de alta/edición ──────────────────────────────────────────────────
// El estado arranca ya con los datos de la maquina en vez de sincronizarse con
// un useEffect. El modal se remonta por su `key` cuando cambia el objetivo, asi
// que la prop no cambia mientras esta montado.
const formDesde = (maquina) => (maquina
  ? {
      nombre: maquina.nombre || '', tipo: maquina.tipo || '', marca: maquina.marca || '',
      modelo: maquina.modelo || '', anio: maquina.anio || '', descripcion: maquina.descripcion || '',
      precioDia: maquina.precioDia ?? '', ubicacion: maquina.ubicacion || '',
      estado: maquina.estado || 'PUBLICADA',
    }
  : FORM_VACIO);

const ModalMaquina = ({ maquina, onCerrar, onGuardado }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => formDesde(maquina));
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const datos = { ...form, anio: form.anio ? Number(form.anio) : null };
      const res = maquina
        ? await maquinasService.editar(maquina.id, datos)
        : await maquinasService.crear(datos);
      showToast(maquina ? 'Máquina actualizada' : 'Máquina dada de alta');
      onGuardado(res.maquina);
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
            {maquina ? 'Editar máquina' : 'Dar de alta máquina'}
          </h2>
          <button onClick={onCerrar} className="btn-icon-sm" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={guardar} className="p-8 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="form-group !mb-0">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={set('nombre')} required placeholder="Retroexcavadora CAT 420" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Tipo *</label>
              <input className="form-input" value={form.tipo} onChange={set('tipo')} required placeholder="Retroexcavadora" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Marca</label>
              <input className="form-input" value={form.marca} onChange={set('marca')} placeholder="Caterpillar" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Modelo</label>
              <input className="form-input" value={form.modelo} onChange={set('modelo')} placeholder="420F2" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Año</label>
              <input className="form-input" type="number" value={form.anio} onChange={set('anio')} placeholder="2019" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Precio por día</label>
              <input className="form-input" value={form.precioDia} onChange={set('precioDia')} placeholder="3500.00" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Ubicación</label>
              <input className="form-input" value={form.ubicacion} onChange={set('ubicacion')} placeholder="Patio norte" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Estado</label>
              <select className="form-input form-select" value={form.estado} onChange={set('estado')}>
                <option value="PUBLICADA">Publicada — la ve el equipo</option>
                <option value="BORRADOR">Borrador — solo tú</option>
                <option value="OCULTA">Oculta — retirada</option>
              </select>
            </div>
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Descripción</label>
            <textarea className="form-input min-h-[90px]" value={form.descripcion} onChange={set('descripcion')} placeholder="Con martillo hidráulico, mantenimiento al día…" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary flex-[1.4] py-4 text-xs uppercase tracking-widest">
              {guardando ? 'Guardando…' : maquina ? 'Guardar cambios' : 'Dar de alta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Galería ────────────────────────────────────────────────────────────────
const ModalGaleria = ({ maquina, onCerrar, onCambio }) => {
  const { showToast } = useToast();
  const [imagenes, setImagenes] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Un contador en vez de llamar a una función que hace setState desde el
  // efecto: así la carga vive dentro del propio efecto y puede cancelarse.
  const [recarga, setRecarga] = useState(0);
  const refrescar = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { imagenes: imgs } = await maquinasService.listarImagenes(maquina.id);
        if (vivo) setImagenes(imgs);
      } catch (error) {
        if (vivo) showToast(error.message, 'error');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    // Si el modal se cierra mientras la petición vuela, no tocamos estado de un
    // componente ya desmontado.
    return () => { vivo = false; };
  }, [maquina.id, showToast, recarga]);

  const subir = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      setSubiendo(true);
      await maquinasService.subirImagenes(maquina.id, files);
      showToast('Imágenes subidas');
      refrescar();
      onCambio?.();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  const borrar = async (id) => {
    try {
      await maquinasService.eliminarImagen(id);
      showToast('Imagen eliminada');
      refrescar();
      onCambio?.();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 lg:p-4">
      <div className="bg-[var(--color-surface)] w-full max-w-3xl rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-[var(--color-text)]">Imágenes</h2>
            <p className="text-sm text-[var(--color-text-muted)] font-medium mt-1">{maquina.nombre}</p>
          </div>
          <button onClick={onCerrar} className="btn-icon-sm" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="p-8">
          <label className="flex items-center justify-center gap-2 w-full py-8 rounded-2xl border-2 border-dashed border-[var(--color-border)] cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all mb-6">
            <ImagePlus size={20} className="text-brand-600" />
            <span className="text-sm font-bold text-[var(--color-text-dim)]">
              {subiendo ? 'Subiendo…' : 'Añadir imágenes (máx. 8)'}
            </span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={subir} disabled={subiendo} />
          </label>

          {cargando ? (
            <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
          ) : imagenes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
              Sin imágenes todavía. La primera que subas será la portada.
            </p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {imagenes.map((img, i) => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-[var(--color-border)] aspect-square">
                  <img src={img.url} alt={img.nombre} className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-accent-400 text-[9px] font-black uppercase text-slate-900">
                      Portada
                    </span>
                  )}
                  <button
                    onClick={() => borrar(img.id)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Eliminar imagen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Tarjeta ────────────────────────────────────────────────────────────────
const MaquinaCard = ({ maquina, puedeEditar, onEditar, onGaleria, onEliminar, onToggle }) => {
  const portada = maquina.adjuntos?.[0];
  const estado = ESTADO_CONF[maquina.estado] || ESTADO_CONF.PUBLICADA;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col">
      <div className="relative h-44 bg-[var(--color-surface-3)] flex items-center justify-center">
        {portada ? (
          <img src={portada.url} alt={maquina.nombre} className="w-full h-full object-cover" />
        ) : (
          <Forklift size={40} className="text-[var(--color-text-muted)] opacity-40" />
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${estado.clase}`}>
          {estado.label}
        </span>
        <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
          maquina.disponible ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
        }`}>
          {maquina.disponible ? <CircleDot size={10} /> : <Ban size={10} />}
          {maquina.disponible ? 'Disponible' : 'Ocupada'}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-2">
        <div>
          <h3 className="font-black text-[var(--color-text)] leading-tight">{maquina.nombre}</h3>
          <p className="text-xs font-bold text-[var(--color-text-muted)] mt-0.5">
            {[maquina.tipo, maquina.marca, maquina.modelo, maquina.anio].filter(Boolean).join(' · ')}
          </p>
        </div>

        {maquina.descripcion && (
          <p className="text-xs text-[var(--color-text-dim)] line-clamp-2">{maquina.descripcion}</p>
        )}

        <div className="text-sm font-black text-brand-600 mt-1">{formatoPrecio(maquina.precioDia)}</div>

        {maquina.ubicacion && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-text-muted)]">
            <MapPin size={12} /> {maquina.ubicacion}
          </div>
        )}

        {/* El vínculo con el trabajo real: en qué tareas está metida. */}
        {maquina._count?.tareas > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-black text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2 py-1.5">
            <ClipboardList size={12} />
            En {maquina._count.tareas} tarea{maquina._count.tareas === 1 ? '' : 's'} sin terminar
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] truncate">
            {maquina.propietario?.nombre}
          </span>
          {puedeEditar && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => onToggle(maquina)} className="btn-icon-sm" title={maquina.disponible ? 'Marcar ocupada' : 'Marcar disponible'}>
                {maquina.disponible ? <Ban size={13} /> : <CircleDot size={13} />}
              </button>
              <button onClick={() => onGaleria(maquina)} className="btn-icon-sm" title="Imágenes"><ImagePlus size={13} /></button>
              <button onClick={() => onEditar(maquina)} className="btn-icon-sm" title="Editar"><Pencil size={13} /></button>
              <button onClick={() => onEliminar(maquina)} className="btn-icon-sm hover:!text-red-500 hover:!border-red-200" title="Eliminar"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Página ─────────────────────────────────────────────────────────────────
const MaquinariaPage = () => {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [maquinas, setMaquinas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDisp, setFiltroDisp] = useState('');
  const [modal, setModal] = useState(null);     // {maquina} | {} para nueva
  const [galeria, setGaleria] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [{ maquinas: lista }, { tipos: t }] = await Promise.all([
        maquinasService.listar({ q: busqueda, tipo: filtroTipo, disponible: filtroDisp }),
        maquinasService.tipos(),
      ]);
      setMaquinas(lista);
      setTipos(t);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroTipo, filtroDisp, showToast]);

  useEffect(() => {
    const id = setTimeout(cargar, 250); // pequeño respiro al teclear
    return () => clearTimeout(id);
  }, [cargar]);

  // Refleja la misma regla del backend: el permiso es del dueño, o la mesa.
  const puedeEditar = (m) => puedeAdministrar(usuario) || m.propietarioId === usuario?.id;

  const eliminar = async (maquina) => {
    if (!window.confirm(`¿Eliminar "${maquina.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await maquinasService.eliminar(maquina.id);
      showToast('Máquina eliminada');
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const alternar = async (maquina) => {
    try {
      await maquinasService.cambiarDisponibilidad(maquina.id, !maquina.disponible);
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (cargando && maquinas.length === 0) return <PageSkeleton cards={6} />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl lg:text-5xl font-black text-[var(--color-text)] tracking-tight leading-none">
            Maquinaria
          </h1>
          <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-medium mt-2">
            Catálogo de equipo en renta
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary shrink-0">
          <Plus size={18} /> Dar de alta máquina
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            className="form-input !pl-10"
            placeholder="Buscar por nombre, marca o modelo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="form-input form-select lg:w-52" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input form-select lg:w-52" value={filtroDisp} onChange={(e) => setFiltroDisp(e.target.value)}>
          <option value="">Disponibles y ocupadas</option>
          <option value="true">Solo disponibles</option>
          <option value="false">Solo ocupadas</option>
        </select>
      </div>

      {maquinas.length === 0 ? (
        <div className="text-center py-20 rounded-[24px] border border-dashed border-[var(--color-border)]">
          <Forklift size={44} className="mx-auto text-[var(--color-text-muted)] opacity-40 mb-4" />
          <p className="font-black text-[var(--color-text)]">Sin máquinas todavía</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {busqueda || filtroTipo || filtroDisp ? 'Prueba a quitar los filtros.' : 'Da de alta la primera con el botón de arriba.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {maquinas.map((m) => (
            <MaquinaCard
              key={m.id}
              maquina={m}
              puedeEditar={puedeEditar(m)}
              onEditar={(x) => setModal({ maquina: x })}
              onGaleria={setGaleria}
              onEliminar={eliminar}
              onToggle={alternar}
            />
          ))}
        </div>
      )}

      {modal && (
        <ModalMaquina
          key={modal.maquina?.id ?? 'nueva'}
          maquina={modal.maquina}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
      {galeria && (
        <ModalGaleria maquina={galeria} onCerrar={() => setGaleria(null)} onCambio={cargar} />
      )}
    </div>
  );
};

export default MaquinariaPage;
