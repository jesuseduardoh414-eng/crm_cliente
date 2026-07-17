// Maquinaria asignada a una obra, con su operador.
//
// Va en su propio componente y no dentro de ProyectoDetallePage porque esa
// pagina ya pasa de 1.100 lineas; aqui vive todo lo de la asignacion.

import { useState, useEffect, useCallback } from 'react';
import {
  Forklift,
  HardHat,
  Plus,
  Pencil,
  Trash2,
  X,
  CalendarRange,
  MapPin,
  AlertTriangle,
  UserX,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { maquinasService, proyectosService } from '../services/api';

const iniciales = (nombre = '') => nombre
  .split(' ').filter(Boolean).slice(0, 2)
  .map((p) => p.charAt(0).toUpperCase()).join('') || '?';

const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : null;

const rangoFechas = (a) => {
  const i = fechaCorta(a.fechaInicio);
  const f = fechaCorta(a.fechaFin);
  if (!i && !f) return null;
  if (i && f) return `${i} — ${f}`;
  return i ? `Desde ${i}` : `Hasta ${f}`;
};

const FORM_VACIO = { maquinaId: '', operadorId: '', fechaInicio: '', fechaFin: '', notas: '' };

const formDesde = (asignacion) => (asignacion
  ? {
      maquinaId: asignacion.maquinaId ?? '',
      operadorId: asignacion.operadorId ?? '',
      fechaInicio: asignacion.fechaInicio ? asignacion.fechaInicio.slice(0, 10) : '',
      fechaFin: asignacion.fechaFin ? asignacion.fechaFin.slice(0, 10) : '',
      notas: asignacion.notas || '',
    }
  : FORM_VACIO);

// ── Modal de asignación ────────────────────────────────────────────────────
const ModalAsignar = ({ proyectoId, asignacion, maquinas, operadores, yaAsignadas, onCerrar, onGuardado }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => formDesde(asignacion));
  const [guardando, setGuardando] = useState(false);
  const editando = Boolean(asignacion);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  // Al asignar, solo se ofrecen las que no estan ya en la obra: el backend lo
  // rechaza con 409, pero es mejor no ofrecer lo que va a fallar.
  const disponibles = editando
    ? maquinas
    : maquinas.filter((m) => !yaAsignadas.includes(m.id));

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const datos = {
        operadorId: form.operadorId === '' ? null : Number(form.operadorId),
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
        notas: form.notas,
      };
      if (editando) {
        await proyectosService.actualizarAsignacion(asignacion.id, datos);
      } else {
        await proyectosService.asignarMaquina(proyectoId, { ...datos, maquinaId: Number(form.maquinaId) });
      }
      showToast(editando ? 'Asignación actualizada' : 'Máquina asignada a la obra');
      onGuardado();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const sinMaquinas = !editando && disponibles.length === 0;

  return (
    <div className="fixed inset-0 z-[1200] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 lg:p-4">
      <div className="bg-[var(--color-surface)] w-full max-w-xl rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-center sticky top-0 bg-[var(--color-surface)] z-10">
          <div>
            <h2 className="text-xl font-black text-[var(--color-text)] tracking-tight">
              {editando ? 'Editar asignación' : 'Asignar maquinaria'}
            </h2>
            {editando && (
              <p className="text-sm text-[var(--color-text-muted)] font-medium mt-0.5">
                {asignacion.maquina.nombre}
              </p>
            )}
          </div>
          <button onClick={onCerrar} className="btn-icon-sm" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={guardar} className="p-8 space-y-5">
          {sinMaquinas ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-sm font-bold text-orange-700">No hay máquinas que asignar</p>
              <p className="text-xs text-orange-600 mt-1">
                {maquinas.length === 0
                  ? 'Todavía no hay maquinaria dada de alta. Créala primero en la sección Maquinaria.'
                  : 'Todas las máquinas del catálogo ya están asignadas a esta obra.'}
              </p>
            </div>
          ) : (
            <>
              {!editando && (
                <div className="form-group !mb-0">
                  <label className="form-label">Máquina *</label>
                  <select className="form-input form-select" value={form.maquinaId} onChange={set('maquinaId')} required>
                    <option value="">Elige una máquina…</option>
                    {disponibles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} — {m.tipo}{m.disponible ? '' : ' (marcada como ocupada)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group !mb-0">
                <label className="form-label">Operador</label>
                <select className="form-input form-select" value={form.operadorId} onChange={set('operadorId')}>
                  <option value="">Sin operador asignado todavía</option>
                  {operadores.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} — {o.especialidad}
                      {o.disponible === false ? ' (ocupado)' : ''}
                    </option>
                  ))}
                </select>
                {operadores.length === 0 && (
                  <p className="text-[11px] font-semibold text-orange-600 mt-1">
                    No hay operadores dados de alta. Puedes asignar la máquina ahora y ponerle operador después.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="form-group !mb-0">
                  <label className="form-label">Desde</label>
                  <input className="form-input" type="date" value={form.fechaInicio} onChange={set('fechaInicio')} />
                </div>
                <div className="form-group !mb-0">
                  <label className="form-label">Hasta</label>
                  <input className="form-input" type="date" value={form.fechaFin} onChange={set('fechaFin')} />
                </div>
              </div>

              <div className="form-group !mb-0">
                <label className="form-label">Notas</label>
                <textarea className="form-input min-h-[70px]" value={form.notas} onChange={set('notas')} placeholder="Para excavación de cimientos…" />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 px-6 py-3.5 rounded-2xl text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]">
              Cancelar
            </button>
            {!sinMaquinas && (
              <button type="submit" disabled={guardando} className="btn-primary flex-[1.4] py-3.5 text-xs uppercase tracking-widest">
                {guardando ? 'Guardando…' : editando ? 'Guardar' : 'Asignar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Tarjeta de asignación ──────────────────────────────────────────────────
const AsignacionCard = ({ asignacion, puedeGestionar, onEditar, onRetirar }) => {
  const { maquina, operador } = asignacion;
  const portada = maquina.adjuntos?.[0];
  const fechas = rangoFechas(asignacion);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex gap-4 items-start">
      <div className="w-16 h-16 rounded-xl bg-[var(--color-surface-3)] shrink-0 overflow-hidden flex items-center justify-center">
        {portada
          ? <img src={portada.url} alt={maquina.nombre} className="w-full h-full object-cover" />
          : <Forklift size={22} className="text-[var(--color-text-muted)] opacity-40" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-black text-[var(--color-text)] text-sm truncate">{maquina.nombre}</h4>
            <p className="text-[11px] font-bold text-[var(--color-text-muted)]">
              {[maquina.tipo, maquina.marca, maquina.modelo].filter(Boolean).join(' · ')}
            </p>
          </div>
          {puedeGestionar && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => onEditar(asignacion)} className="btn-icon-sm" title="Editar asignación"><Pencil size={12} /></button>
              <button onClick={() => onRetirar(asignacion)} className="btn-icon-sm hover:!text-red-500 hover:!border-red-200" title="Retirar de la obra"><Trash2 size={12} /></button>
            </div>
          )}
        </div>

        {/* El operador: la tercera pata de la asignación */}
        <div className="mt-2.5">
          {operador ? (
            <div className="flex items-center gap-2">
              {/* La ficha del operador no es una cuenta: su foto sale de sus
                  adjuntos, no de un perfil de usuario. */}
              {operador.adjuntos?.[0]
                ? <img src={operador.adjuntos[0].url} alt={operador.nombre} className="w-[22px] h-[22px] rounded-full object-cover shrink-0" />
                : <span className="w-[22px] h-[22px] rounded-full bg-brand-100 text-brand-700 text-[0.55rem] font-black flex items-center justify-center shrink-0">
                    {iniciales(operador.nombre)}
                  </span>}
              <span className="text-[11px] font-black text-[var(--color-text)]">{operador.nombre}</span>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                {operador.especialidad}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 border border-orange-100 text-[10px] font-black uppercase tracking-widest text-orange-600">
              <UserX size={11} /> Sin operador
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-[var(--color-text-muted)]">
          {fechas && <span className="inline-flex items-center gap-1"><CalendarRange size={11} /> {fechas}</span>}
          {maquina.ubicacion && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {maquina.ubicacion}</span>}
        </div>

        {asignacion.notas && (
          <p className="mt-2 text-[11px] text-[var(--color-text-dim)] line-clamp-2">{asignacion.notas}</p>
        )}
      </div>
    </div>
  );
};

// ── Sección ────────────────────────────────────────────────────────────────
const ProyectoMaquinaria = ({ proyectoId, puedeGestionar }) => {
  const { showToast } = useToast();
  const [asignaciones, setAsignaciones] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const refrescar = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { asignaciones: lista } = await proyectosService.listarMaquinaria(proyectoId);
        if (vivo) setAsignaciones(lista);

        // El catálogo y los operadores solo hacen falta para el formulario; si
        // fallan, la lista de asignadas se sigue viendo.
        const [maq, ops] = await Promise.allSettled([
          maquinasService.listar(),
          proyectosService.operadoresAsignables(),
        ]);
        if (vivo && maq.status === 'fulfilled') setMaquinas(maq.value.maquinas);
        if (vivo && ops.status === 'fulfilled') setOperadores(ops.value.operadores);
      } catch (error) {
        if (vivo) showToast(error.message, 'error');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [proyectoId, showToast, recarga]);

  const retirar = async (asignacion) => {
    if (!window.confirm(`¿Retirar "${asignacion.maquina.nombre}" de esta obra? La máquina no se borra del catálogo.`)) return;
    try {
      await proyectosService.retirarMaquina(asignacion.id);
      showToast('Máquina retirada de la obra');
      refrescar();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const sinOperador = asignaciones.filter((a) => !a.operador).length;

  return (
    <div className="mb-6 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shrink-0">
            <Forklift size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Maquinaria de la obra
            </div>
            <div className="text-sm font-black text-[var(--color-text)]">
              {cargando ? 'Cargando…' : `${asignaciones.length} máquina${asignaciones.length === 1 ? '' : 's'} asignada${asignaciones.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>
        {puedeGestionar && (
          <button onClick={() => setModal({})} className="btn-primary !py-2.5 !px-4 text-[11px] uppercase tracking-widest shrink-0">
            <Plus size={15} /> Asignar
          </button>
        )}
      </div>

      {/* Aviso: máquina en la obra pero sin quien la opere */}
      {!cargando && sinOperador > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-[11px] font-bold text-orange-700">
          <AlertTriangle size={13} />
          {sinOperador} máquina{sinOperador === 1 ? '' : 's'} sin operador asignado
        </div>
      )}

      {cargando ? (
        <div className="h-20 rounded-2xl bg-[var(--color-surface-3)] animate-pulse" />
      ) : asignaciones.length === 0 ? (
        <div className="text-center py-8 rounded-2xl border border-dashed border-[var(--color-border)]">
          <HardHat size={30} className="mx-auto text-[var(--color-text-muted)] opacity-40 mb-2" />
          <p className="text-sm font-black text-[var(--color-text)]">Sin maquinaria asignada</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {puedeGestionar
              ? 'Asigna una máquina a esta obra y dile quién la opera.'
              : 'Nadie ha asignado maquinaria a esta obra todavía.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {asignaciones.map((a) => (
            <AsignacionCard
              key={a.id}
              asignacion={a}
              puedeGestionar={puedeGestionar}
              onEditar={(x) => setModal({ asignacion: x })}
              onRetirar={retirar}
            />
          ))}
        </div>
      )}

      {modal && (
        <ModalAsignar
          key={modal.asignacion?.id ?? 'nueva'}
          proyectoId={proyectoId}
          asignacion={modal.asignacion}
          maquinas={maquinas}
          operadores={operadores}
          yaAsignadas={asignaciones.map((a) => a.maquinaId)}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); refrescar(); }}
        />
      )}
    </div>
  );
};

export default ProyectoMaquinaria;
