// Operadores disponibles.
// Un operador es un Usuario con rol OPERADOR más su perfil. La disponibilidad
// la lleva él mismo; un ADMIN puede corregirla y dar de alta o de baja.

import { useState, useEffect, useCallback } from 'react';
import {
  HardHat,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  MapPin,
  Phone,
  CircleDot,
  Ban,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { operadoresService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';
import UserAvatar from '../components/UserAvatar';

const FORM_VACIO = {
  usuarioId: '', especialidad: '', descripcion: '', zona: '',
  telefonoContacto: '', tarifaHora: '', experienciaAnios: '', disponible: true,
};

const formatoTarifa = (v) =>
  v === null || v === undefined ? 'Sin tarifa' : `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })} / hora`;

// ── Modal de alta/edición ──────────────────────────────────────────────────
// Estado inicializado desde la prop en vez de sincronizado con un useEffect; el
// modal se remonta por su `key` cuando cambia el operador objetivo.
const formDesde = (operador, candidatos) => (operador
  ? {
      usuarioId: operador.usuarioId,
      especialidad: operador.especialidad || '',
      descripcion: operador.descripcion || '',
      zona: operador.zona || '',
      telefonoContacto: operador.telefonoContacto || '',
      tarifaHora: operador.tarifaHora ?? '',
      experienciaAnios: operador.experienciaAnios ?? '',
      disponible: operador.disponible,
    }
  : { ...FORM_VACIO, usuarioId: candidatos?.[0]?.id ?? '' });

const ModalOperador = ({ operador, candidatos, onCerrar, onGuardado }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => formDesde(operador, candidatos));
  const [guardando, setGuardando] = useState(false);
  const editando = Boolean(operador);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const datos = {
        especialidad: form.especialidad,
        descripcion: form.descripcion,
        zona: form.zona,
        telefonoContacto: form.telefonoContacto,
        tarifaHora: form.tarifaHora,
        experienciaAnios: form.experienciaAnios ? Number(form.experienciaAnios) : null,
        disponible: Boolean(form.disponible),
      };
      if (editando) {
        await operadoresService.editar(operador.id, datos);
      } else {
        await operadoresService.crear({ ...datos, usuarioId: Number(form.usuarioId) });
      }
      showToast(editando ? 'Operador actualizado' : 'Operador dado de alta');
      onGuardado();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const sinCandidatos = !editando && (!candidatos || candidatos.length === 0);

  return (
    <div className="fixed inset-0 z-[1100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 lg:p-4">
      <div className="bg-[var(--color-surface)] w-full max-w-2xl rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-center sticky top-0 bg-[var(--color-surface)] z-10">
          <h2 className="text-xl lg:text-2xl font-black text-[var(--color-text)] tracking-tight">
            {editando ? 'Editar operador' : 'Dar de alta operador'}
          </h2>
          <button onClick={onCerrar} className="btn-icon-sm" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={guardar} className="p-8 space-y-5">
          {sinCandidatos ? (
            // El alta no crea cuentas: solo añade el perfil a un usuario que ya
            // existe. Si no queda ninguno libre, hay que invitarlo primero.
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-sm font-bold text-orange-700">No hay usuarios disponibles</p>
              <p className="text-xs text-orange-600 mt-1">
                Todos los usuarios activos ya son operadores. Para añadir uno nuevo, invítalo primero
                desde Usuarios y luego vuelve aquí.
              </p>
            </div>
          ) : (
            <>
              {!editando && (
                <div className="form-group !mb-0">
                  <label className="form-label">Usuario *</label>
                  <select className="form-input form-select" value={form.usuarioId} onChange={set('usuarioId')} required>
                    {candidatos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} — {c.email}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    Al darlo de alta, su rol pasa a OPERADOR.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="form-group !mb-0">
                  <label className="form-label">Especialidad *</label>
                  <input className="form-input" value={form.especialidad} onChange={set('especialidad')} required placeholder="Retroexcavadora" />
                </div>
                <div className="form-group !mb-0">
                  <label className="form-label">Zona</label>
                  <input className="form-input" value={form.zona} onChange={set('zona')} placeholder="Zona norte" />
                </div>
                <div className="form-group !mb-0">
                  <label className="form-label">Teléfono de contacto</label>
                  <input className="form-input" value={form.telefonoContacto} onChange={set('telefonoContacto')} placeholder="555-1234" />
                </div>
                <div className="form-group !mb-0">
                  <label className="form-label">Tarifa por hora</label>
                  <input className="form-input" value={form.tarifaHora} onChange={set('tarifaHora')} placeholder="350.00" />
                </div>
                <div className="form-group !mb-0">
                  <label className="form-label">Años de experiencia</label>
                  <input className="form-input" type="number" value={form.experienciaAnios} onChange={set('experienciaAnios')} placeholder="8" />
                </div>
                <div className="form-group !mb-0">
                  <label className="form-label">Disponibilidad</label>
                  <select className="form-input form-select" value={String(form.disponible)} onChange={(e) => setForm((f) => ({ ...f, disponible: e.target.value === 'true' }))}>
                    <option value="true">Disponible</option>
                    <option value="false">No disponible</option>
                  </select>
                </div>
              </div>

              <div className="form-group !mb-0">
                <label className="form-label">Descripción</label>
                <textarea className="form-input min-h-[80px]" value={form.descripcion} onChange={set('descripcion')} placeholder="Certificaciones, experiencia, notas…" />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]">
              Cancelar
            </button>
            {!sinCandidatos && (
              <button type="submit" disabled={guardando} className="btn-primary flex-[1.4] py-4 text-xs uppercase tracking-widest">
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Dar de alta'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Tarjeta ────────────────────────────────────────────────────────────────
const OperadorCard = ({ operador, puedeEditar, esAdmin, onEditar, onEliminar, onToggle }) => (
  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-5 shadow-sm hover:shadow-lg transition-all flex flex-col gap-3">
    <div className="flex items-start gap-3">
      <UserAvatar usuario={operador.usuario} size={48} radius={14} />
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-[var(--color-text)] leading-tight truncate">{operador.usuario?.nombre}</h3>
        <p className="text-xs font-bold text-brand-600 mt-0.5">{operador.especialidad}</p>
      </div>
      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
        operador.disponible ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
      }`}>
        {operador.disponible ? <CircleDot size={10} /> : <Ban size={10} />}
        {operador.disponible ? 'Libre' : 'Ocupado'}
      </span>
    </div>

    {operador.descripcion && (
      <p className="text-xs text-[var(--color-text-dim)] line-clamp-2">{operador.descripcion}</p>
    )}

    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-bold text-[var(--color-text-muted)]">
      {operador.zona && <span className="flex items-center gap-1"><MapPin size={12} /> {operador.zona}</span>}
      {operador.telefonoContacto && <span className="flex items-center gap-1"><Phone size={12} /> {operador.telefonoContacto}</span>}
      {operador.experienciaAnios != null && <span className="flex items-center gap-1"><Clock size={12} /> {operador.experienciaAnios} años</span>}
    </div>

    <div className="text-sm font-black text-[var(--color-text)]">{formatoTarifa(operador.tarifaHora)}</div>

    {puedeEditar && (
      <div className="mt-auto pt-3 border-t border-[var(--color-border-light)] flex items-center justify-end gap-1.5">
        <button onClick={() => onToggle(operador)} className="btn-icon-sm" title={operador.disponible ? 'Marcar ocupado' : 'Marcar libre'}>
          {operador.disponible ? <Ban size={13} /> : <CircleDot size={13} />}
        </button>
        <button onClick={() => onEditar(operador)} className="btn-icon-sm" title="Editar"><Pencil size={13} /></button>
        {esAdmin && (
          <button onClick={() => onEliminar(operador)} className="btn-icon-sm hover:!text-red-500 hover:!border-red-200" title="Dar de baja"><Trash2 size={13} /></button>
        )}
      </div>
    )}
  </div>
);

// ── Página ─────────────────────────────────────────────────────────────────
const OperadoresPage = () => {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [operadores, setOperadores] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloDisponibles, setSoloDisponibles] = useState(true);
  const [modal, setModal] = useState(null);

  const esAdmin = usuario?.rol === 'ADMIN';

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { operadores: lista } = await operadoresService.listar({
        especialidad: busqueda,
        ...(soloDisponibles ? {} : { todos: 'true' }),
      });
      setOperadores(lista);
      if (esAdmin) {
        try {
          const { candidatos: c } = await operadoresService.candidatos();
          setCandidatos(c);
        } catch { /* no bloquea el listado */ }
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [busqueda, soloDisponibles, esAdmin, showToast]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const puedeEditar = (o) => esAdmin || o.usuarioId === usuario?.id;

  const darDeBaja = async (operador) => {
    if (!window.confirm(`¿Dar de baja a ${operador.usuario?.nombre} como operador? Su cuenta se conserva y vuelve a ser MIEMBRO.`)) return;
    try {
      await operadoresService.eliminar(operador.id);
      showToast('Operador dado de baja');
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const alternar = async (operador) => {
    try {
      await operadoresService.cambiarDisponibilidad(operador.id, !operador.disponible);
      cargar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (cargando && operadores.length === 0) return <PageSkeleton cards={6} />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl lg:text-5xl font-black text-[var(--color-text)] tracking-tight leading-none">
            Operadores
          </h1>
          <p className="text-sm lg:text-base text-[var(--color-text-muted)] font-medium mt-2">
            Quién está disponible para operar
          </p>
        </div>
        {esAdmin && (
          <button onClick={() => setModal({})} className="btn-primary shrink-0">
            <Plus size={18} /> Dar de alta operador
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            className="form-input !pl-10"
            placeholder="Buscar por especialidad…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <button
          onClick={() => setSoloDisponibles((v) => !v)}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
            soloDisponibles
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)]'
          }`}
        >
          {soloDisponibles ? 'Solo disponibles' : 'Todos'}
        </button>
      </div>

      {operadores.length === 0 ? (
        <div className="text-center py-20 rounded-[24px] border border-dashed border-[var(--color-border)]">
          <HardHat size={44} className="mx-auto text-[var(--color-text-muted)] opacity-40 mb-4" />
          <p className="font-black text-[var(--color-text)]">
            {soloDisponibles ? 'Ningún operador disponible' : 'Sin operadores todavía'}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {soloDisponibles ? 'Prueba a ver todos.' : esAdmin ? 'Da de alta el primero con el botón de arriba.' : 'Un administrador debe darlos de alta.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {operadores.map((o) => (
            <OperadorCard
              key={o.id}
              operador={o}
              puedeEditar={puedeEditar(o)}
              esAdmin={esAdmin}
              onEditar={(x) => setModal({ operador: x })}
              onEliminar={darDeBaja}
              onToggle={alternar}
            />
          ))}
        </div>
      )}

      {modal && (
        <ModalOperador
          key={modal.operador?.id ?? 'nuevo'}
          operador={modal.operador}
          candidatos={candidatos}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
};

export default OperadoresPage;
