// Catálogo de operadores.
//
// Un operador es una ficha, no una cuenta: cualquier miembro da de alta al que
// conoce, y el resto del equipo lo califica, dice si lo recomienda y deja
// constancia de lo que pasa con él. Editar la ficha solo puede quien la subió
// (o un ADMIN); calificarla y reportarla, cualquiera menos quien la subió.

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
  Star,
  ThumbsUp,
  ThumbsDown,
  Flag,
  TriangleAlert,
  MessageSquare,
  ImagePlus,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { puedeAdministrar } from '../utils/roles';
import { useToast } from '../context/ToastContext';
import { operadoresService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';
import UserAvatar from '../components/UserAvatar';

const FORM_VACIO = {
  nombre: '', especialidad: '', descripcion: '', zona: '',
  telefonoContacto: '', tarifaHora: '', experienciaAnios: '', disponible: true,
};

const formatoTarifa = (v) =>
  v === null || v === undefined ? 'Sin tarifa' : `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })} / hora`;

const fecha = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

const iniciales = (nombre = '') => nombre
  .split(' ').filter(Boolean).slice(0, 2)
  .map((p) => p.charAt(0).toUpperCase()).join('') || '?';

// ── Piezas compartidas ─────────────────────────────────────────────────────

const FotoOperador = ({ operador, size = 48 }) => {
  const foto = operador.adjuntos?.[0]?.url;
  if (foto) {
    return (
      <img
        src={foto}
        alt={operador.nombre}
        className="object-cover shrink-0"
        style={{ width: size, height: size, borderRadius: 14 }}
      />
    );
  }
  return (
    <div
      className="shrink-0 flex items-center justify-center bg-brand-100 text-brand-700 font-black"
      style={{ width: size, height: size, borderRadius: 14, fontSize: size / 3 }}
    >
      {iniciales(operador.nombre)}
    </div>
  );
};

// Las estrellas hacen de lectura y de control: con onChange se puede votar y
// sin él solo se muestran. Son el mismo dibujo, no merecen dos componentes.
const Estrellas = ({ valor, onChange, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => {
      const activa = n <= Math.round(valor || 0);
      const Icono = (
        <Star
          size={size}
          className={activa ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-border)]'}
        />
      );
      return onChange ? (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} de 5`} className="hover:scale-110 transition-transform">
          {Icono}
        </button>
      ) : (
        <span key={n}>{Icono}</span>
      );
    })}
  </div>
);

const ResumenReputacion = ({ resumen }) => {
  if (!resumen || resumen.totalCalificaciones === 0) {
    return <p className="text-[11px] font-bold text-[var(--color-text-muted)]">Sin calificaciones todavía</p>;
  }
  const { promedio, totalCalificaciones, recomiendan } = resumen;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Estrellas valor={promedio} />
      <span className="text-xs font-black text-[var(--color-text)]">{promedio.toFixed(1)}</span>
      <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
        ({totalCalificaciones})
      </span>
      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
        recomiendan > totalCalificaciones / 2
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-orange-50 text-orange-700'
      }`}>
        <ThumbsUp size={9} /> {recomiendan} de {totalCalificaciones}
      </span>
    </div>
  );
};

// ── Modal de alta/edición ──────────────────────────────────────────────────
const formDesde = (operador) => (operador
  ? {
      nombre: operador.nombre || '',
      especialidad: operador.especialidad || '',
      descripcion: operador.descripcion || '',
      zona: operador.zona || '',
      telefonoContacto: operador.telefonoContacto || '',
      tarifaHora: operador.tarifaHora ?? '',
      experienciaAnios: operador.experienciaAnios ?? '',
      disponible: operador.disponible,
    }
  : FORM_VACIO);

const ModalOperador = ({ operador, onCerrar, onGuardado }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => formDesde(operador));
  const [archivos, setArchivos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const editando = Boolean(operador);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const datos = {
        nombre: form.nombre,
        especialidad: form.especialidad,
        descripcion: form.descripcion,
        zona: form.zona,
        telefonoContacto: form.telefonoContacto,
        tarifaHora: form.tarifaHora,
        experienciaAnios: form.experienciaAnios === '' ? null : Number(form.experienciaAnios),
        disponible: Boolean(form.disponible),
      };

      const res = editando
        ? await operadoresService.editar(operador.id, datos)
        : await operadoresService.crear(datos);

      // La foto va después: necesita el id de la ficha.
      if (archivos.length > 0) {
        try {
          await operadoresService.subirImagenes(res.operador.id, archivos);
        } catch (err) {
          showToast(`Operador guardado, pero la foto falló: ${err.message}`, 'error');
          onGuardado();
          return;
        }
      }

      showToast(editando ? 'Operador actualizado' : 'Operador dado de alta');
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
            {editando ? 'Editar operador' : 'Dar de alta operador'}
          </h2>
          <button onClick={onCerrar} className="btn-icon-sm" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={guardar} className="p-8 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="form-group !mb-0">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={set('nombre')} required placeholder="Juan Herrera" />
            </div>
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
              <input className="form-input" value={form.telefonoContacto} onChange={set('telefonoContacto')} placeholder="55 1234 5678" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Tarifa por hora</label>
              <input className="form-input" value={form.tarifaHora} onChange={set('tarifaHora')} placeholder="350.00" />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Años de experiencia</label>
              <input className="form-input" type="number" min="0" value={form.experienciaAnios} onChange={set('experienciaAnios')} placeholder="8" />
            </div>
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Disponibilidad</label>
            <select className="form-input form-select" value={String(form.disponible)} onChange={(e) => setForm((f) => ({ ...f, disponible: e.target.value === 'true' }))}>
              <option value="true">Disponible</option>
              <option value="false">No disponible</option>
            </select>
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Descripción</label>
            <textarea className="form-input min-h-[80px]" value={form.descripcion} onChange={set('descripcion')} placeholder="Certificaciones, experiencia, con quién ha trabajado…" />
          </div>

          <div className="form-group !mb-0">
            <label className="form-label">Foto</label>
            <label className="flex items-center justify-center gap-2 w-full py-6 rounded-2xl border-2 border-dashed border-[var(--color-border)] cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all">
              <ImagePlus size={18} className="text-brand-600" />
              <span className="text-xs font-bold text-[var(--color-text-dim)]">
                {archivos.length > 0 ? `${archivos.length} imagen(es) seleccionada(s)` : 'Elegir foto'}
              </span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setArchivos(Array.from(e.target.files || []))} />
            </label>
          </div>

          {!editando && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              El operador no necesita cuenta: es una ficha del catálogo. Quedas como quien lo dio de
              alta, así que solo tú (o un administrador) podrán editarlo.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary flex-[1.4] py-4 text-xs uppercase tracking-widest">
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Dar de alta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Modal de detalle: calificar y reportar ─────────────────────────────────
const ModalDetalle = ({ operadorId, onCerrar, onCambio }) => {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [operador, setOperador] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('calificaciones');

  const [voto, setVoto] = useState({ puntuacion: 0, recomendable: null, comentario: '' });
  const [enviandoVoto, setEnviandoVoto] = useState(false);

  const [reporte, setReporte] = useState({ tipo: 'OBSERVACION', contenido: '' });
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  const esMesa = puedeAdministrar(usuario);

  const cargar = useCallback(async () => {
    try {
      const { operador: o } = await operadoresService.obtener(operadorId);
      setOperador(o);

      // Si ya opiné, el formulario arranca con mi voto: es una edición, no un
      // voto nuevo.
      const mio = o.calificaciones?.find((c) => c.autorId === usuario?.id);
      if (mio) {
        setVoto({ puntuacion: mio.puntuacion, recomendable: mio.recomendable, comentario: mio.comentario || '' });
      }
    } catch (error) {
      showToast(error.message, 'error');
      onCerrar();
    } finally {
      setCargando(false);
    }
  }, [operadorId, usuario?.id, showToast, onCerrar]);

  useEffect(() => {
    const id = setTimeout(cargar, 0);
    return () => clearTimeout(id);
  }, [cargar]);

  const esMiFicha = operador?.registradoPorId === usuario?.id;
  const miCalificacion = operador?.calificaciones?.find((c) => c.autorId === usuario?.id);

  const enviarVoto = async (e) => {
    e.preventDefault();
    if (!voto.puntuacion) return showToast('Elige de 1 a 5 estrellas', 'error');
    if (voto.recomendable === null) return showToast('Indica si lo recomiendas', 'error');

    try {
      setEnviandoVoto(true);
      await operadoresService.calificar(operadorId, {
        puntuacion: voto.puntuacion,
        recomendable: voto.recomendable,
        comentario: voto.comentario,
      });
      showToast(miCalificacion ? 'Calificación actualizada' : 'Gracias por tu calificación');
      await cargar();
      onCambio();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setEnviandoVoto(false);
    }
  };

  const borrarVoto = async () => {
    try {
      await operadoresService.eliminarCalificacion(operadorId);
      setVoto({ puntuacion: 0, recomendable: null, comentario: '' });
      showToast('Calificación eliminada');
      await cargar();
      onCambio();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const enviarReporte = async (e) => {
    e.preventDefault();
    try {
      setEnviandoReporte(true);
      await operadoresService.reportar(operadorId, reporte);
      setReporte({ tipo: 'OBSERVACION', contenido: '' });
      showToast(reporte.tipo === 'REPORTE' ? 'Reporte enviado' : 'Observación registrada');
      await cargar();
      onCambio();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setEnviandoReporte(false);
    }
  };

  const resolver = async (reporteId, estado) => {
    try {
      await operadoresService.resolverReporte(reporteId, estado);
      showToast('Reporte actualizado');
      await cargar();
      onCambio();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const borrarReporte = async (reporteId) => {
    if (!window.confirm('¿Eliminar esta entrada?')) return;
    try {
      await operadoresService.eliminarReporte(reporteId);
      showToast('Entrada eliminada');
      await cargar();
      onCambio();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 lg:p-4">
      <div className="bg-[var(--color-surface)] w-full max-w-3xl rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {cargando || !operador ? (
          <div className="p-12 text-center text-sm font-bold text-[var(--color-text-muted)]">Cargando…</div>
        ) : (
          <>
            <div className="px-8 py-6 border-b border-[var(--color-border)] flex justify-between items-start gap-4 sticky top-0 bg-[var(--color-surface)] z-10">
              <div className="flex items-start gap-4 min-w-0">
                <FotoOperador operador={operador} size={56} />
                <div className="min-w-0">
                  <h2 className="text-xl lg:text-2xl font-black text-[var(--color-text)] tracking-tight truncate">
                    {operador.nombre}
                  </h2>
                  <p className="text-xs font-bold text-brand-600">{operador.especialidad}</p>
                  <div className="mt-1.5"><ResumenReputacion resumen={operador.resumen} /></div>
                </div>
              </div>
              <button onClick={onCerrar} className="btn-icon-sm shrink-0" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="px-8 pt-5 flex gap-2 border-b border-[var(--color-border)]">
              {[
                { k: 'calificaciones', label: `Calificaciones (${operador.calificaciones?.length || 0})` },
                { k: 'reportes', label: `Observaciones y reportes (${operador.reportes?.length || 0})` },
              ].map(({ k, label }) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                    tab === k
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-8 space-y-6">
              {tab === 'calificaciones' && (
                <>
                  {esMiFicha ? (
                    // Quien sube la ficha no se califica a si mismo: seria juez
                    // y parte, y el promedio dejaria de decir nada.
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-3)] p-5">
                      <p className="text-xs font-bold text-[var(--color-text-dim)]">
                        Diste de alta a este operador, así que no puedes calificarlo. Los demás
                        miembros sí.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={enviarVoto} className="rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                        {miCalificacion ? 'Tu calificación' : '¿Trabajaste con él?'}
                      </p>

                      <div className="flex items-center gap-3 flex-wrap">
                        <Estrellas
                          valor={voto.puntuacion}
                          size={26}
                          onChange={(n) => setVoto((v) => ({ ...v, puntuacion: n }))}
                        />
                        {voto.puntuacion > 0 && (
                          <span className="text-sm font-black text-[var(--color-text)]">{voto.puntuacion}/5</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {[
                          { valor: true, label: 'Lo recomiendo', Icon: ThumbsUp, activo: 'bg-emerald-500 text-white border-emerald-500' },
                          { valor: false, label: 'No lo recomiendo', Icon: ThumbsDown, activo: 'bg-red-500 text-white border-red-500' },
                        ].map(({ valor, label, Icon, activo }) => (
                          <button
                            key={String(valor)}
                            type="button"
                            onClick={() => setVoto((v) => ({ ...v, recomendable: valor }))}
                            className={`flex-1 px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                              voto.recomendable === valor
                                ? activo
                                : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:bg-[var(--color-surface-3)]'
                            }`}
                          >
                            <Icon size={13} /> {label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        className="form-input min-h-[70px]"
                        value={voto.comentario}
                        onChange={(e) => setVoto((v) => ({ ...v, comentario: e.target.value }))}
                        placeholder="¿Cómo trabajó? (opcional)"
                      />

                      <div className="flex gap-2">
                        {miCalificacion && (
                          <button type="button" onClick={borrarVoto} className="px-4 py-3 rounded-xl border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:!text-red-500">
                            Quitar
                          </button>
                        )}
                        <button type="submit" disabled={enviandoVoto} className="btn-primary flex-1 py-3 text-[10px] uppercase tracking-widest">
                          {enviandoVoto ? 'Guardando…' : miCalificacion ? 'Actualizar calificación' : 'Calificar'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {operador.calificaciones?.length === 0 ? (
                      <p className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                        Nadie lo ha calificado todavía.
                      </p>
                    ) : (
                      operador.calificaciones.map((c) => (
                        <div key={c.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar usuario={c.autor} size={30} radius={999} fontSize="0.65rem" />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-[var(--color-text)] truncate">{c.autor?.nombre}</p>
                                <p className="text-[10px] text-[var(--color-text-muted)]">{fecha(c.creadoEn)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Estrellas valor={c.puntuacion} />
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
                                c.recomendable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                              }`}>
                                {c.recomendable ? <ThumbsUp size={9} /> : <ThumbsDown size={9} />}
                                {c.recomendable ? 'Recomendado' : 'No'}
                              </span>
                            </div>
                          </div>
                          {c.comentario && (
                            <p className="text-xs text-[var(--color-text-dim)] mt-2.5">{c.comentario}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {tab === 'reportes' && (
                <>
                  <form onSubmit={enviarReporte} className="rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
                    <div className="flex gap-2">
                      {[
                        { k: 'OBSERVACION', label: 'Observación', Icon: MessageSquare, desc: 'Una nota para el equipo' },
                        { k: 'REPORTE', label: 'Reporte', Icon: Flag, desc: 'Algo que hay que revisar' },
                      ].map(({ k, label, Icon }) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setReporte((r) => ({ ...r, tipo: k }))}
                          className={`flex-1 px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                            reporte.tipo === k
                              ? k === 'REPORTE' ? 'bg-red-500 text-white border-red-500' : 'bg-brand-600 text-white border-brand-600'
                              : 'bg-[var(--color-surface)] text-[var(--color-text-dim)] border-[var(--color-border)] hover:bg-[var(--color-surface-3)]'
                          }`}
                        >
                          <Icon size={13} /> {label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      className="form-input min-h-[80px]"
                      value={reporte.contenido}
                      onChange={(e) => setReporte((r) => ({ ...r, contenido: e.target.value }))}
                      required
                      placeholder={reporte.tipo === 'REPORTE'
                        ? 'Qué pasó, cuándo y en qué obra. Lo verán los administradores.'
                        : 'Algo que el equipo debería saber antes de contratarlo.'}
                    />

                    <button type="submit" disabled={enviandoReporte} className="btn-primary w-full py-3 text-[10px] uppercase tracking-widest">
                      {enviandoReporte ? 'Enviando…' : reporte.tipo === 'REPORTE' ? 'Enviar reporte' : 'Guardar observación'}
                    </button>
                  </form>

                  <div className="space-y-3">
                    {operador.reportes?.length === 0 ? (
                      <p className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                        Sin observaciones ni reportes.
                      </p>
                    ) : (
                      operador.reportes.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-2xl border p-4 ${
                            r.tipo === 'REPORTE' && r.estado === 'ABIERTO'
                              ? 'border-red-200 bg-red-50/40'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar usuario={r.autor} size={30} radius={999} fontSize="0.65rem" />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-[var(--color-text)] truncate">{r.autor?.nombre}</p>
                                <p className="text-[10px] text-[var(--color-text-muted)]">{fecha(r.creadoEn)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
                                r.tipo === 'REPORTE' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {r.tipo === 'REPORTE' ? <Flag size={9} /> : <MessageSquare size={9} />}
                                {r.tipo === 'REPORTE' ? 'Reporte' : 'Observación'}
                              </span>
                              {r.estado !== 'ABIERTO' && (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                                  {r.estado === 'REVISADO' ? 'Revisado' : 'Descartado'}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-[var(--color-text-dim)] mt-2.5">{r.contenido}</p>

                          {r.revisadoPor && (
                            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
                              Revisado por {r.revisadoPor.nombre}
                            </p>
                          )}

                          {(esMesa || r.autorId === usuario?.id) && (
                            <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-[var(--color-border-light)]">
                              {esMesa && r.estado === 'ABIERTO' && (
                                <>
                                  <button onClick={() => resolver(r.id, 'REVISADO')} className="btn-icon-sm" title="Marcar revisado">
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => resolver(r.id, 'DESCARTADO')} className="btn-icon-sm" title="Descartar">
                                    <Ban size={13} />
                                  </button>
                                </>
                              )}
                              {esMesa && r.estado !== 'ABIERTO' && (
                                <button onClick={() => resolver(r.id, 'ABIERTO')} className="btn-icon-sm" title="Reabrir">
                                  <TriangleAlert size={13} />
                                </button>
                              )}
                              <button onClick={() => borrarReporte(r.id)} className="btn-icon-sm hover:!text-red-500 hover:!border-red-200" title="Eliminar">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Tarjeta ────────────────────────────────────────────────────────────────
const OperadorCard = ({ operador, puedeEditar, onAbrir, onEditar, onEliminar, onToggle }) => (
  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-5 shadow-sm hover:shadow-lg transition-all flex flex-col gap-3">
    <button onClick={() => onAbrir(operador)} className="flex items-start gap-3 text-left">
      <FotoOperador operador={operador} />
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-[var(--color-text)] leading-tight truncate">{operador.nombre}</h3>
        <p className="text-xs font-bold text-brand-600 mt-0.5">{operador.especialidad}</p>
      </div>
      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
        operador.disponible ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
      }`}>
        {operador.disponible ? <CircleDot size={10} /> : <Ban size={10} />}
        {operador.disponible ? 'Libre' : 'Ocupado'}
      </span>
    </button>

    <ResumenReputacion resumen={operador.resumen} />

    {operador.resumen?.reportesAbiertos > 0 && (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-700">
        <TriangleAlert size={12} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          {operador.resumen.reportesAbiertos} reporte{operador.resumen.reportesAbiertos > 1 ? 's' : ''} sin revisar
        </span>
      </div>
    )}

    {operador.descripcion && (
      <p className="text-xs text-[var(--color-text-dim)] line-clamp-2">{operador.descripcion}</p>
    )}

    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-bold text-[var(--color-text-muted)]">
      {operador.zona && <span className="flex items-center gap-1"><MapPin size={12} /> {operador.zona}</span>}
      {operador.telefonoContacto && <span className="flex items-center gap-1"><Phone size={12} /> {operador.telefonoContacto}</span>}
      {operador.experienciaAnios != null && <span className="flex items-center gap-1"><Clock size={12} /> {operador.experienciaAnios} años</span>}
    </div>

    <div className="text-sm font-black text-[var(--color-text)]">{formatoTarifa(operador.tarifaHora)}</div>

    <div className="mt-auto pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between gap-2">
      <p className="text-[10px] text-[var(--color-text-muted)] truncate">
        Lo subió {operador.registradoPor?.nombre}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => onAbrir(operador)} className="btn-icon-sm" title="Ver calificaciones">
          <Star size={13} />
        </button>
        {puedeEditar && (
          <>
            <button onClick={() => onToggle(operador)} className="btn-icon-sm" title={operador.disponible ? 'Marcar ocupado' : 'Marcar libre'}>
              {operador.disponible ? <Ban size={13} /> : <CircleDot size={13} />}
            </button>
            <button onClick={() => onEditar(operador)} className="btn-icon-sm" title="Editar"><Pencil size={13} /></button>
            <button onClick={() => onEliminar(operador)} className="btn-icon-sm hover:!text-red-500 hover:!border-red-200" title="Dar de baja"><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  </div>
);

// ── Página ─────────────────────────────────────────────────────────────────
const OperadoresPage = () => {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [operadores, setOperadores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloDisponibles, setSoloDisponibles] = useState(true);
  const [modal, setModal] = useState(null);
  const [detalleId, setDetalleId] = useState(null);

  const esMesa = puedeAdministrar(usuario);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { operadores: lista } = await operadoresService.listar({
        q: busqueda,
        ...(soloDisponibles ? {} : { todos: 'true' }),
      });
      setOperadores(lista);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [busqueda, soloDisponibles, showToast]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const puedeEditar = (o) => esMesa || o.registradoPorId === usuario?.id;

  const darDeBaja = async (operador) => {
    if (!window.confirm(`¿Dar de baja a ${operador.nombre}? Se van con él sus calificaciones y reportes.`)) return;
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
            Quién está disponible y qué tal trabaja
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary shrink-0">
          <Plus size={18} /> Dar de alta operador
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            className="form-input !pl-10"
            placeholder="Buscar por nombre o especialidad…"
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
            {soloDisponibles ? 'Prueba a ver todos.' : 'Da de alta al primero con el botón de arriba.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {operadores.map((o) => (
            <OperadorCard
              key={o.id}
              operador={o}
              puedeEditar={puedeEditar(o)}
              onAbrir={(x) => setDetalleId(x.id)}
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
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}

      {detalleId && (
        <ModalDetalle
          key={detalleId}
          operadorId={detalleId}
          onCerrar={() => setDetalleId(null)}
          onCambio={cargar}
        />
      )}
    </div>
  );
};

export default OperadoresPage;
