import { useRef, useState } from 'react';
import { tareasService } from '../services/api';
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  RotateCcw,
  UploadCloud,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};

const card = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: '1.25rem',
  padding: '2rem',
  width: '100%', maxWidth: '1100px',
  maxHeight: '92vh',
  overflowY: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
};

const FORMAT_INFO = {
  excel: {
    label: 'Excel',
    ext: '.xlsx,.xls',
    columnas: [
      { campo: 'numeroActividad', desc: 'Opcional. Entero para ordenar tareas secuenciales.' },
      { campo: 'titulo', desc: 'Obligatorio. Nombre de la tarea.' },
      { campo: 'descripcion', desc: 'Opcional. Contexto adicional.' },
      { campo: 'estado', desc: 'PENDIENTE | EN_PROGRESO | HECHO (default: PENDIENTE)' },
      { campo: 'prioridad', desc: 'BAJA | MEDIA | ALTA (default: MEDIA)' },
      { campo: 'fechaInicio', desc: 'Opcional. Fecha de comienzo (YYYY-MM-DD)' },
      { campo: 'venceEn', desc: 'Opcional. Fecha límite (YYYY-MM-DD)' },
      { campo: 'asignadoEmail', desc: 'Opcional. Solo se usa si eliges "Según el archivo"' },
    ],
  },
  json: {
    label: 'JSON',
    ext: '.json',
    columnas: [
      { campo: 'numeroActividad', desc: 'Opcional. Entero para ordenar tareas secuenciales.' },
      { campo: 'titulo', desc: 'Obligatorio. Texto de la tarea.' },
      { campo: 'descripcion', desc: 'Opcional.' },
      { campo: 'estado', desc: '"PENDIENTE" | "EN_PROGRESO" | "HECHO"' },
      { campo: 'prioridad', desc: '"BAJA" | "MEDIA" | "ALTA"' },
      { campo: 'fechaInicio', desc: 'Opcional. "YYYY-MM-DD"' },
      { campo: 'venceEn', desc: 'Opcional. "YYYY-MM-DD"' },
      { campo: 'asignadoEmail', desc: 'Opcional. Solo se usa si eliges "Según el archivo"' },
    ],
  },
};

const MODOS = [
  { key: 'yo', label: 'Para mí', icon: <User size={18} strokeWidth={2.5} />, desc: 'Todas las tareas quedan asignadas a ti' },
  { key: 'miembro', label: 'Para un miembro', icon: <Users size={18} strokeWidth={2.5} />, desc: 'Elige quién será el responsable' },
  { key: 'archivo', label: 'Según el archivo', icon: <FileText size={18} strokeWidth={2.5} />, desc: 'Usa la columna asignadoEmail del archivo' },
];

const ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'HECHO'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA'];

const normalizarEstado = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';

  const mapa = {
    PENDIENTE: 'PENDIENTE',
    'POR HACER': 'PENDIENTE',
    POR_HACER: 'PENDIENTE',
    EN_PROGRESO: 'EN_PROGRESO',
    'EN PROGRESO': 'EN_PROGRESO',
    'EN-PROGRESO': 'EN_PROGRESO',
    HECHO: 'HECHO',
    COMPLETADO: 'HECHO',
    TERMINADO: 'HECHO',
  };

  return mapa[raw] || raw;
};

const normalizarPrioridad = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';

  const mapa = {
    BAJA: 'BAJA',
    MEDIA: 'MEDIA',
    ALTA: 'ALTA',
    LOW: 'BAJA',
    MEDIUM: 'MEDIA',
    HIGH: 'ALTA',
  };

  return mapa[raw] || raw;
};

const normalizarFila = (fila = {}) => ({
  fila: fila.fila,
  numeroActividad: fila.numeroActividad ?? '',
  titulo: fila.titulo ?? '',
  descripcion: fila.descripcion ?? '',
  estado: normalizarEstado(fila.estado),
  prioridad: normalizarPrioridad(fila.prioridad),
  fechaInicio: fila.fechaInicio ?? '',
  venceEn: fila.venceEn ?? '',
  asignadoEmail: fila.asignadoEmail ?? '',
  omitida: !!fila.omitida,
});

const validarFilaPreview = (fila) => {
  const errores = [];
  if (!String(fila.titulo || '').trim()) errores.push('El título es obligatorio.');

  if (fila.numeroActividad !== '' && fila.numeroActividad !== null && fila.numeroActividad !== undefined) {
    const numero = Number(fila.numeroActividad);
    if (!Number.isInteger(numero) || numero <= 0) errores.push('El número de actividad debe ser un entero mayor a 0.');
  }

  if (fila.estado && !ESTADOS.includes(normalizarEstado(fila.estado))) {
    errores.push('El estado no es válido.');
  }

  if (fila.prioridad && !PRIORIDADES.includes(normalizarPrioridad(fila.prioridad))) {
    errores.push('La prioridad no es válida.');
  }

  if (fila.fechaInicio && Number.isNaN(new Date(fila.fechaInicio).getTime())) {
    errores.push('La fecha de inicio no es válida.');
  }

  if (fila.venceEn && Number.isNaN(new Date(fila.venceEn).getTime())) {
    errores.push('La fecha límite no es válida.');
  }

  return errores;
};

const getFilaAsignacion = (fila, modo, miembroId, usuarios = [], usuarioActual) => {
  if (modo === 'yo') return usuarioActual?.nombre ? `${usuarioActual.nombre} (yo)` : 'Tú';
  if (modo === 'miembro') {
    const miembro = usuarios.find((u) => String(u.id) === String(miembroId)) || (usuarioActual && String(usuarioActual.id) === String(miembroId) ? usuarioActual : null);
    return miembro ? miembro.nombre : 'Sin responsable';
  }
  if (!fila.asignadoEmail) return 'Sin asignar';
  const miembro = usuarios.find((u) => String(u.email || '').toLowerCase() === String(fila.asignadoEmail || '').toLowerCase());
  return miembro ? miembro.nombre : 'Correo no encontrado';
};

const ModalImportar = ({ proyectoId, usuarios = [], usuarioActual, onClose, onImportado }) => {
  const [tab, setTab] = useState('excel');
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [modo, setModo] = useState('yo');
  const [miembroId, setMiembroId] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [previewArchivo, setPreviewArchivo] = useState('');
  const inputRef = useRef(null);

  const fmt = FORMAT_INFO[tab];
  const previewActiva = previewRows.length > 0 && !resultado;
  const filasActivas = previewRows.filter((fila) => !fila.omitida);
  const filasInvalidas = filasActivas.filter((fila) => validarFilaPreview(fila).length > 0);
  const filasConAvisos = filasActivas.filter((fila) => modo === 'archivo' && fila.asignadoEmail && !usuarios.some((u) => String(u.email || '').toLowerCase() === String(fila.asignadoEmail || '').toLowerCase()));

  const validarArchivo = (file, tipoActual) => {
    if (!file) return null;
    const nombre = String(file.name || '').toLowerCase();
    if (tipoActual === 'json' && !nombre.endsWith('.json')) return 'El archivo seleccionado no es un JSON válido.';
    if (tipoActual === 'excel' && !(nombre.endsWith('.xlsx') || nombre.endsWith('.xls'))) return 'El archivo seleccionado no es un Excel válido.';
    return null;
  };

  const resetFlujo = () => {
    setArchivo(null);
    setResultado(null);
    setErrorGlobal('');
    setPreviewRows([]);
    setPreviewArchivo('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    resetFlujo();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    const errorArchivo = validarArchivo(file, tab);
    if (errorArchivo) {
      resetFlujo();
      setErrorGlobal(errorArchivo);
      return;
    }
    setArchivo(file);
    setResultado(null);
    setErrorGlobal('');
    setPreviewRows([]);
    setPreviewArchivo('');
  };

  const handlePreview = async () => {
    if (!archivo) {
      setErrorGlobal('Selecciona un archivo antes de revisar.');
      return;
    }
    if (modo === 'miembro' && !miembroId) {
      setErrorGlobal('Selecciona un miembro.');
      return;
    }

    setCargando(true);
    setErrorGlobal('');
    setResultado(null);

    try {
      const asignadoId = modo === 'miembro' ? miembroId : null;
      const data = await tareasService.previewImportar(proyectoId, archivo, modo, asignadoId);
      setPreviewRows((data.filas || []).map((fila) => normalizarFila(fila)));
      setPreviewArchivo(data.archivo || archivo.name);
    } catch (err) {
      setErrorGlobal(err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarPreview = async () => {
    if (filasActivas.length === 0) {
      setErrorGlobal('No hay filas activas para guardar.');
      return;
    }
    if (filasInvalidas.length > 0) {
      setErrorGlobal('Corrige las filas marcadas antes de guardar.');
      return;
    }
    if (modo === 'miembro' && !miembroId) {
      setErrorGlobal('Selecciona un miembro.');
      return;
    }

    setGuardando(true);
    setErrorGlobal('');

    try {
      const payload = filasActivas.map((fila) => ({
        numeroActividad: fila.numeroActividad,
        titulo: fila.titulo,
        descripcion: fila.descripcion,
        estado: fila.estado,
        prioridad: fila.prioridad,
        fechaInicio: fila.fechaInicio,
        venceEn: fila.venceEn,
        asignadoEmail: fila.asignadoEmail,
      }));
      const asignadoId = modo === 'miembro' ? miembroId : null;
      const data = await tareasService.confirmarImportacion(proyectoId, payload, modo, asignadoId);
      setResultado(data);
      setPreviewRows([]);
      if (data.creadas > 0 && onImportado) onImportado(data);
    } catch (err) {
      setErrorGlobal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleCerrar = () => onClose();

  const updateFila = (filaIndex, field, value) => {
    setPreviewRows((prev) => prev.map((fila, index) => (
      index === filaIndex
        ? {
            ...fila,
            [field]:
              field === 'estado'
                ? normalizarEstado(value)
                : field === 'prioridad'
                  ? normalizarPrioridad(value)
                  : value,
          }
        : fila
    )));
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && handleCerrar()}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Download size={22} strokeWidth={2.5} style={{ color: 'var(--color-primary)' }} />
              Importar tareas
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              Revisa el archivo antes de guardar y corrige cualquier fila aquí mismo.
            </p>
          </div>
          <button onClick={handleCerrar} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={24} />
          </button>
        </div>

        {!resultado && (
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
              ¿A quién asignar las tareas?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {MODOS.map((m) => (
                <label
                  key={m.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 0.9rem',
                    border: `1.5px solid ${modo === m.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: '0.6rem', cursor: 'pointer',
                    background: modo === m.key ? 'rgb(var(--brand-600) / 0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="modoAsignacion"
                    value={m.key}
                    checked={modo === m.key}
                    onChange={() => {
                      setModo(m.key);
                      setPreviewRows([]);
                      setResultado(null);
                    }}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <div style={{ color: modo === m.key ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex' }}>{m.icon}</div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.88rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {modo === 'miembro' && (
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--color-text-muted)' }}>
                  Miembro responsable:
                </label>
                <select
                  value={miembroId}
                  onChange={(e) => setMiembroId(e.target.value)}
                  className="form-input form-select"
                  style={{ width: '100%' }}
                >
                  <option value="">— Selecciona un miembro —</option>
                  {usuarioActual && <option value={usuarioActual.id}>{usuarioActual.nombre} (yo)</option>}
                  {usuarios.filter((u) => u.id !== usuarioActual?.id).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} — {u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {!resultado && (
          <div style={{
            display: 'flex', gap: '0.25rem', marginBottom: '1rem',
            background: 'var(--color-surface-3)', borderRadius: '0.6rem',
            padding: '0.25rem', border: '1px solid var(--color-border)',
          }}>
            {['excel', 'json'].map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                style={{
                  flex: 1, padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem', border: 'none',
                  cursor: 'pointer', fontWeight: tab === t ? '700' : '400',
                  fontSize: '0.9rem', transition: 'all 0.15s',
                  background: tab === t ? 'var(--color-primary)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                {t === 'excel' ? <FileSpreadsheet size={16} strokeWidth={2.5} /> : <Braces size={16} strokeWidth={2.5} />} {FORMAT_INFO[t].label}
              </button>
            ))}
          </div>
        )}

        {!previewActiva && !resultado && (
          <>
            <button
              onClick={() => tareasService.descargarPlantilla(tab === 'excel' ? 'excel' : 'json')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                width: '100%', padding: '0.65rem 1rem', marginBottom: '1rem',
                background: 'transparent', border: '1px dashed var(--color-border)',
                borderRadius: '0.6rem', color: 'var(--color-text-muted)', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: '500',
              }}
            >
              <Download size={14} /> Descargar plantilla de ejemplo ({fmt.label})
            </button>

            <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--color-border)', background: 'rgba(148,163,184,0.08)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>
                Campos esperados
              </div>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {fmt.columnas.map((col) => (
                  <div key={col.campo} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>{col.campo}</strong>: {col.desc}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>
                Seleccionar archivo {fmt.label}:
              </label>
              <div
                style={{
                  border: `2px dashed ${archivo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                  background: archivo ? 'rgb(var(--brand-600) / 0.05)' : 'transparent',
                }}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  const errorArchivo = validarArchivo(file, tab);
                  if (errorArchivo) {
                    resetFlujo();
                    setErrorGlobal(errorArchivo);
                    return;
                  }
                  setArchivo(file);
                  setErrorGlobal('');
                }}
              >
                <input ref={inputRef} type="file" accept={fmt.ext} style={{ display: 'none' }} onChange={handleFileChange} />
                {archivo ? (
                  <div>
                    <div style={{ color: 'var(--color-primary)', display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      <File size={32} />
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{archivo.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      {(archivo.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: 'var(--color-text-dim)', display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                      <UploadCloud size={40} />
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                      Arrastra tu archivo aquí o <span style={{ color: 'var(--color-primary)' }}>haz clic</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      {fmt.ext} · Máximo 5 MB
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {errorGlobal && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.6rem', padding: '0.75rem 1rem', marginBottom: '1rem',
            color: '#f87171', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <XCircle size={16} /> {errorGlobal}
          </div>
        )}

        {previewActiva && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '800' }}>Vista previa de importación</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{previewArchivo}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgb(var(--brand-500) / 0.12)', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: '800' }}>
                  {filasActivas.length} activas
                </div>
                <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', color: '#dc2626', fontSize: '0.78rem', fontWeight: '800' }}>
                  {filasInvalidas.length} con error
                </div>
                <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(245,158,11,0.12)', color: '#d97706', fontSize: '0.78rem', fontWeight: '800' }}>
                  {filasConAvisos.length} con aviso
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {previewRows.map((fila, index) => {
                const errores = fila.omitida ? [] : validarFilaPreview(fila);
                const asignacion = getFilaAsignacion(fila, modo, miembroId, usuarios, usuarioActual);

                return (
                  <div
                    key={`fila-${fila.fila}-${index}`}
                    style={{
                      border: `1px solid ${fila.omitida ? 'rgba(148,163,184,0.3)' : errores.length ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}`,
                      borderRadius: '1rem',
                      background: fila.omitida ? 'rgba(148,163,184,0.07)' : 'var(--color-surface)',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.9rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '900', color: 'var(--color-text)' }}>Fila {fila.fila}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Asignación final: {asignacion}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateFila(index, 'omitida', !fila.omitida)}
                        style={{
                          border: '1px solid var(--color-border)',
                          background: fila.omitida ? 'rgba(16,185,129,0.08)' : 'transparent',
                          color: fila.omitida ? '#059669' : 'var(--color-text-muted)',
                          borderRadius: '999px',
                          padding: '0.45rem 0.8rem',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        {fila.omitida ? 'Reactivar fila' : 'Omitir fila'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Número</span>
                        <input disabled={fila.omitida} value={fila.numeroActividad} onChange={(e) => updateFila(index, 'numeroActividad', e.target.value)} className="form-input" type="number" min="1" />
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem', gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Título</span>
                        <input disabled={fila.omitida} value={fila.titulo} onChange={(e) => updateFila(index, 'titulo', e.target.value)} className="form-input" />
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Estado</span>
                        <select disabled={fila.omitida} value={fila.estado || 'PENDIENTE'} onChange={(e) => updateFila(index, 'estado', e.target.value)} className="form-input form-select">
                          {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Prioridad</span>
                        <select disabled={fila.omitida} value={fila.prioridad || 'MEDIA'} onChange={(e) => updateFila(index, 'prioridad', e.target.value)} className="form-input form-select">
                          {PRIORIDADES.map((prioridad) => <option key={prioridad} value={prioridad}>{prioridad}</option>)}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Inicio</span>
                        <input disabled={fila.omitida} value={fila.fechaInicio} onChange={(e) => updateFila(index, 'fechaInicio', e.target.value)} className="form-input" type="date" />
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Límite</span>
                        <input disabled={fila.omitida} value={fila.venceEn} onChange={(e) => updateFila(index, 'venceEn', e.target.value)} className="form-input" type="date" />
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem', gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Descripción</span>
                        <textarea disabled={fila.omitida} value={fila.descripcion} onChange={(e) => updateFila(index, 'descripcion', e.target.value)} className="form-input" rows="2" style={{ resize: 'vertical' }} />
                      </label>
                      <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)' }}>Correo asignado</span>
                        <input
                          disabled={fila.omitida || modo !== 'archivo'}
                          value={fila.asignadoEmail}
                          onChange={(e) => updateFila(index, 'asignadoEmail', e.target.value)}
                          className="form-input"
                          placeholder={modo === 'archivo' ? 'correo@empresa.com' : 'Lo define el modo de asignación'}
                        />
                      </label>
                    </div>

                    {!fila.omitida && errores.length > 0 && (
                      <div style={{ padding: '0.75rem 0.85rem', borderRadius: '0.75rem', background: 'rgba(239,68,68,0.08)', color: '#dc2626', display: 'grid', gap: '0.3rem' }}>
                        {errores.map((error) => (
                          <div key={error} style={{ fontSize: '0.78rem', fontWeight: '700' }}>{error}</div>
                        ))}
                      </div>
                    )}

                    {!fila.omitida && modo === 'archivo' && fila.asignadoEmail && !usuarios.some((u) => String(u.email || '').toLowerCase() === String(fila.asignadoEmail || '').toLowerCase()) && (
                      <div style={{ marginTop: '0.65rem', padding: '0.75rem 0.85rem', borderRadius: '0.75rem', background: 'rgba(245,158,11,0.08)', color: '#b45309', fontSize: '0.78rem', fontWeight: '700' }}>
                        El correo no coincide con un miembro del proyecto. Se usará la asignación por defecto si existe; si no, quedará sin asignar.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {resultado && (
          <div style={{ marginBottom: '1.25rem' }}>
            {resultado.creadas > 0 && (
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '0.6rem', padding: '0.75rem 1rem', marginBottom: '0.75rem',
                color: '#34d399', fontSize: '0.95rem', fontWeight: '700',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <CheckCircle2 size={18} /> {resultado.creadas} tarea{resultado.creadas !== 1 ? 's' : ''} creada{resultado.creadas !== 1 ? 's' : ''} correctamente
              </div>
            )}

            {resultado.errores?.length > 0 && (
              <div style={{
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
                borderRadius: '0.6rem', padding: '0.75rem 1rem',
              }}>
                <p style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={14} /> {resultado.errores.length} fila{resultado.errores.length !== 1 ? 's' : ''} no se pudo guardar:
                </p>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  {resultado.errores.map((error, i) => (
                    <div key={`${error.fila}-${i}`} style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      <strong style={{ color: '#f59e0b' }}>Fila {error.fila}:</strong> {error.razon}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleCerrar}
            style={{
              flex: 1, padding: '0.75rem',
              background: 'transparent', border: '1px solid var(--color-border)',
              borderRadius: '0.75rem', color: 'var(--color-text-muted)',
              cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
            }}
          >
            Cerrar
          </button>

          {previewActiva && (
            <button
              onClick={() => {
                setPreviewRows([]);
                setErrorGlobal('');
                setResultado(null);
              }}
              style={{
                flex: 1, padding: '0.75rem',
                background: 'transparent', border: '1px solid var(--color-border)',
                borderRadius: '0.75rem', color: 'var(--color-text-muted)',
                cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
              }}
            >
              Cambiar archivo
            </button>
          )}

          {!previewActiva && !resultado && (
            <button
              onClick={handlePreview}
              disabled={cargando || !archivo}
              className="btn-primary"
              style={{ flex: 1.5, padding: '0.75rem', fontSize: '0.9rem', opacity: !archivo ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {cargando ? <><Loader2 size={16} className="animate-spin" /> Revisando...</> : <><Info size={16} /> Revisar archivo</>}
            </button>
          )}

          {previewActiva && (
            <button
              onClick={handleGuardarPreview}
              disabled={guardando || filasActivas.length === 0 || filasInvalidas.length > 0}
              className="btn-primary"
              style={{ flex: 1.5, padding: '0.75rem', fontSize: '0.9rem', opacity: filasActivas.length === 0 || filasInvalidas.length > 0 ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Download size={16} strokeWidth={2.5} /> Guardar tareas</>}
            </button>
          )}

          {resultado && (
            <button
              onClick={() => {
                resetFlujo();
                setResultado(null);
              }}
              className="btn-primary"
              style={{ flex: 1.5, padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <RotateCcw size={16} /> Importar otro archivo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalImportar;
