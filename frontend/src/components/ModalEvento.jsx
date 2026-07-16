import { useState, useEffect } from 'react';
import {
  X,
  Save,
  Calendar,
  Users,
  Check,
  AlertTriangle,
  Trash2,
  Globe,
  Clock,
  MapPin,
  Video,
  Link2,
} from 'lucide-react';
import { agendaService, adjuntosService, usuariosService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePreferences } from '../context/PreferencesContext';
import TaskAttachments from './TaskAttachments';
import RangeDatePicker from './RangeDatePicker';

// Estos valores se guardan en la BD (Evento.color), asi que tienen que ser hex
// literal y no tokens: un var() aqui se persistiria como texto sin resolver.
// Si cambia el azul de marca, este hex hay que moverlo a mano.
const COLOR_CATEGORIA = {
  tarea: '#16a34a',
  reunion: '#7c3aed',
  evento: '#1f47dd',
};

const getColorCategoria = (tipo) => COLOR_CATEGORIA[tipo] || COLOR_CATEGORIA.evento;

const toPickerDate = (dateValue, timeValue = '12:00') => {
  if (!dateValue) return null;
  return new Date(`${dateValue}T${timeValue}`);
};

const formatTimeRangeLabel = (start, end, label) => {
  if (!start || !end) return label;
  return `${start} - ${end}`;
};

const TimeRangePicker = ({ start, end, onChange }) => {
  const { t } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '0.85rem 1rem',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
          fontWeight: '700',
          color: 'var(--color-text)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Clock size={18} style={{ color: 'var(--color-primary)', opacity: 0.85 }} />
        <span style={{ flex: 1 }}>{formatTimeRangeLabel(start, end, t('eventSelectTime'))}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--color-surface)',
              borderRadius: '1.75rem',
              border: '1px solid var(--color-border)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1.4rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900' }}>{t('eventSelectTime')}</h3>
              <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dim)' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '900', color: 'var(--color-text-dim)', letterSpacing: '0.06em' }}>{t('eventFrom').toUpperCase()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface-2)', borderRadius: '0.95rem', border: '1px solid var(--color-border)', padding: '0 0.9rem' }}>
                  <Clock size={15} style={{ color: 'var(--color-primary)' }} />
                  <input
                    type="time"
                    className="form-input"
                    style={{ border: 'none', background: 'transparent', paddingLeft: 0 }}
                    value={start}
                    onChange={(e) => onChange({ start: e.target.value, end })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '900', color: 'var(--color-text-dim)', letterSpacing: '0.06em' }}>{t('eventTo').toUpperCase()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface-2)', borderRadius: '0.95rem', border: '1px solid var(--color-border)', padding: '0 0.9rem' }}>
                  <Clock size={15} style={{ color: 'var(--color-primary)' }} />
                  <input
                    type="time"
                    className="form-input"
                    style={{ border: 'none', background: 'transparent', paddingLeft: 0 }}
                    value={end}
                    onChange={(e) => onChange({ start, end: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem 1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ flex: 1, padding: '0.9rem', borderRadius: '1rem', border: '1px solid var(--color-border)', background: 'transparent', fontWeight: '800', cursor: 'pointer', color: 'var(--color-text-dim)' }}
              >
                {t('close')}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ flex: 1.4, padding: '0.9rem', borderRadius: '1rem', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: '900', cursor: 'pointer' }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const TIPOS = [
  { id: 'evento',  labelKey: 'eventTypeEvent',   icon: <Calendar size={16} /> },
  { id: 'reunion', labelKey: 'eventTypeMeeting',  icon: <Users size={16} /> },
];

const buildInitialForm = ({ evento, prefill }) => {
  if (evento) {
    const start = new Date(evento.fechaInicio);
    const end = evento.fechaFin ? new Date(evento.fechaFin) : null;
    let patronParsed = null;
    try {
      patronParsed = evento.patronRecurrencia ? JSON.parse(evento.patronRecurrencia) : null;
    } catch {
      patronParsed = null;
    }

    return {
      titulo: evento.titulo,
      descripcion: evento.descripcion || '',
      tipo: evento.tipo,
      modalidad: evento.modalidad || 'presencial',
      ubicacion: evento.ubicacion || '',
      url_reunion: evento.urlReunion || '',
      instrucciones_acceso: evento.instruccionesAcceso || '',
      fecha_inicio: start.toISOString().split('T')[0],
      hora_inicio: start.toTimeString().slice(0, 5),
      fecha_fin: end ? end.toISOString().split('T')[0] : start.toISOString().split('T')[0],
      hora_fin: end ? end.toTimeString().slice(0, 5) : '10:00',
      todo_el_dia: evento.todoElDia,
      color: getColorCategoria(evento.tipo),
      alerta_minutos: evento.alertaMinutos || 15,
      es_compartido: evento.esCompartido || false,
      es_global: evento.esGlobal || false,
      proyecto_id: evento.proyectoId || '',
      invitados_ids: evento.invitados?.map((i) => i.usuarioId) || [],
      es_recurrente: evento.esRecurrente || false,
      recur_dias: patronParsed?.dias || [],
      recur_hora_inicio: patronParsed?.horaInicio || '00:00',
      recur_hora_fin: patronParsed?.horaFin || '23:59',
      fecha_fin_recurrencia: evento.fechaFinRecurr ? new Date(evento.fechaFinRecurr).toISOString().split('T')[0] : '',
    };
  }

  if (prefill) {
    const start = prefill.fechaInicio || new Date();
    return {
      titulo: '',
      descripcion: '',
      tipo: 'evento',
      modalidad: 'presencial',
      ubicacion: '',
      url_reunion: '',
      instrucciones_acceso: '',
      fecha_inicio: start.toISOString().split('T')[0],
      hora_inicio: start.toTimeString().slice(0, 5),
      fecha_fin: start.toISOString().split('T')[0],
      hora_fin: '10:00',
      todo_el_dia: false,
      color: getColorCategoria('evento'),
      alerta_minutos: 15,
      es_compartido: false,
      es_global: false,
      proyecto_id: '',
      invitados_ids: [],
      es_recurrente: false,
      recur_dias: [],
      recur_hora_inicio: '00:00',
      recur_hora_fin: '23:59',
      fecha_fin_recurrencia: '',
    };
  }

  return {
    titulo: '',
    descripcion: '',
    tipo: 'evento',
    modalidad: 'presencial',
    ubicacion: '',
    url_reunion: '',
    instrucciones_acceso: '',
    fecha_inicio: '',
    hora_inicio: '09:00',
    fecha_fin: '',
    hora_fin: '10:00',
    todo_el_dia: false,
    color: getColorCategoria('evento'),
    alerta_minutos: 15,
    es_compartido: false,
    es_global: false,
    proyecto_id: '',
    invitados_ids: [],
    es_recurrente: false,
    recur_dias: [],
    recur_hora_inicio: '00:00',
    recur_hora_fin: '23:59',
    fecha_fin_recurrencia: '',
  };
};

const ModalEvento = ({ evento, prefill, onClose, onSave, onDelete }) => {
  const { t } = usePreferences();
  const [form, setForm] = useState(() => buildInitialForm({ evento, prefill }));
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const [cargando, setCargando] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [archivos, setArchivos] = useState([]);

  const esDuenio = !evento || evento.usuarioId === usuario?.id || evento.creadoPorId === usuario?.id;
  const esVirtual = form.modalidad === 'virtual';

  useEffect(() => {
    const cargar = async () => {
      try {
        const resU = await usuariosService.listar();
        setUsuarios(resU.usuarios || []);
      } catch (err) {
        console.error(err);
      }
    };
    cargar();
  }, []);

  useEffect(() => {
    let active = true;

    if (form.es_compartido && !form.es_global && form.invitados_ids.length > 0 && form.fecha_inicio) {
      const fetchDisp = async () => {
        try {
          const res = await agendaService.consultarDisponibilidad({
            usuarios_ids: form.invitados_ids.join(','),
            inicio: `${form.fecha_inicio}T${form.hora_inicio || '00:00'}`,
            fin: `${form.fecha_fin || form.fecha_inicio}T${form.hora_fin || '23:59'}`,
            excluir_id: evento?.id,
          });
          if (active) setDisponibilidad(res.conflictos || []);
        } catch (err) {
          if (active) console.error('Error disponibilidad', err);
        }
      };

      fetchDisp();
    }

    return () => {
      active = false;
      setDisponibilidad([]);
    };
  }, [form.es_compartido, form.es_global, form.invitados_ids, form.fecha_inicio, form.hora_inicio, form.fecha_fin, form.hora_fin, evento?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.es_recurrente && form.recur_dias.length === 0) {
      showToast(t('eventRecurringNoDay'), 'error');
      return;
    }

    setCargando(true);
    try {
      const fInicio = new Date(`${form.fecha_inicio}T${form.hora_inicio || '00:00'}`);
      let fFin = null;
      if (form.tipo !== 'dia_completo') fFin = new Date(`${form.fecha_fin}T${form.hora_fin || '23:59'}`);
      else if (form.tipo === 'dia_completo') fFin = new Date(`${form.fecha_fin}T23:59:59`);

      if (Number.isNaN(fInicio.getTime()) || (fFin && Number.isNaN(fFin.getTime()))) {
        showToast(t('eventInvalidDateTime'), 'error');
        return;
      }

      if (fFin && fFin <= fInicio) {
        showToast(t('eventEndAfterStart'), 'error');
        return;
      }

      if (form.url_reunion) {
        try {
          new URL(form.url_reunion);
        } catch {
          showToast(t('eventInvalidMeetingLink'), 'error');
          return;
        }
      }

      const payload = {
        ...form,
        color: getColorCategoria(form.tipo),
        fecha_inicio: fInicio.toISOString(),
        fecha_fin: fFin ? fFin.toISOString() : null,
        todo_el_dia: form.tipo === 'dia_completo' ? true : form.todo_el_dia,
        proyecto_id: form.proyecto_id ? parseInt(form.proyecto_id, 10) : null,
        patron_recurrencia: form.es_recurrente
          ? {
              tipo: 'semanal',
              dias: form.recur_dias,
              horaInicio: form.recur_hora_inicio,
              horaFin: form.recur_hora_fin,
            }
          : null,
        fecha_fin_recurrencia: form.fecha_fin_recurrencia || null,
      };

      let eventoGuardado = evento;
      if (evento) {
        const res = await agendaService.editar(evento.id, payload);
        eventoGuardado = res.evento || evento;
      } else {
        const res = await agendaService.crear(payload);
        eventoGuardado = res.evento;
      }

      if (archivos.length > 0 && eventoGuardado?.id) {
        await adjuntosService.subir(eventoGuardado.id, archivos, 'agenda');
        setArchivos([]);
      }

      onSave();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const togggleInvitado = (userId) => {
    setForm((prev) => {
      const ids = [...prev.invitados_ids];
      const idx = ids.indexOf(userId);
      if (idx > -1) ids.splice(idx, 1);
      else ids.push(userId);
      return { ...prev, invitados_ids: ids };
    });
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-surface)', padding: '2rem', borderRadius: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.02em' }}>
            {!evento ? t('eventNew') : esDuenio ? t('eventEdit') : t('eventDetails')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ letterSpacing: '0.05em' }}>{t('eventTitleLabel').toUpperCase()}</label>
              {esDuenio ? (
                <input className="form-input" style={{ fontSize: '1rem', padding: '0.85rem 1.25rem' }} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required placeholder={t('eventTitlePlaceholder')} />
              ) : (
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-text)', padding: '0.5rem 0' }}>{form.titulo}</div>
              )}
            </div>
            {esDuenio && (
              <div className="form-group">
                <label className="form-label" style={{ letterSpacing: '0.05em' }}>{t('eventCategory').toUpperCase()}</label>
                <select
                  className="form-input form-select"
                  style={{ fontSize: '1rem', padding: '0.85rem 1.25rem' }}
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value, color: getColorCategoria(e.target.value) })}
                  disabled={!esDuenio}
                >
                  {TIPOS.map((tipo) => <option key={tipo.id} value={tipo.id}>{t(tipo.labelKey)}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ letterSpacing: '0.05em' }}>{t('taskDescription').toUpperCase()}</label>
            {esDuenio ? (
              <textarea
                className="form-input"
                style={{ minHeight: '96px', resize: 'vertical', padding: '1rem 1.25rem' }}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder={t('eventDescriptionPlaceholder')}
              />
            ) : (
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
                {form.descripcion || t('taskNoDescription')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ letterSpacing: '0.05em' }}>{t('eventDuration').toUpperCase()}</label>
              {esDuenio ? (
                <RangeDatePicker
                  from={toPickerDate(form.fecha_inicio, form.hora_inicio || '12:00')}
                  to={toPickerDate(form.fecha_fin, form.hora_fin || form.hora_inicio || '12:00')}
                  placeholder={t('eventDatePlaceholder')}
                  title={t('eventDatePlaceholder')}
                  onChange={(range) => {
                    setForm((prev) => ({
                      ...prev,
                      fecha_inicio: range?.from ? range.from.toISOString().slice(0, 10) : '',
                      fecha_fin: range?.to ? range.to.toISOString().slice(0, 10) : (range?.from ? range.from.toISOString().slice(0, 10) : ''),
                    }));
                  }}
                />
              ) : (
                <div style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '1rem',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)',
                  fontWeight: '800',
                  color: 'var(--color-text)'
                }}>
                  {new Date(form.fecha_inicio).toLocaleDateString()} - {new Date(form.fecha_fin || form.fecha_inicio).toLocaleDateString()}
                </div>
              )}
            </div>

            {form.tipo !== 'dia_completo' && (
              <div className="form-group">
                <label className="form-label" style={{ letterSpacing: '0.05em' }}>{t('eventSelectTime').toUpperCase()}</label>
                {esDuenio ? (
                  <TimeRangePicker
                    start={form.hora_inicio}
                    end={form.hora_fin}
                    onChange={({ start, end }) => setForm((prev) => ({ ...prev, hora_inicio: start, hora_fin: end }))}
                  />
                ) : (
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '1rem',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    fontWeight: '800',
                    color: 'var(--color-text)'
                  }}>
                    {form.hora_inicio} - {form.hora_fin}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ letterSpacing: '0.05em' }}>{t('eventModality').toUpperCase()}</label>
              {esDuenio ? (
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg-base)', padding: '0.4rem', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, modalidad: 'presencial' })}
                    style={{
                      flex: 1,
                      padding: '0.85rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: '900',
                      cursor: 'pointer',
                      background: !esVirtual ? 'var(--color-primary)' : 'transparent',
                      color: !esVirtual ? '#fff' : 'var(--color-text-dim)',
                    }}
                  >
                    {t('eventInPerson').toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, modalidad: 'virtual' })}
                    style={{
                      flex: 1,
                      padding: '0.85rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: '900',
                      cursor: 'pointer',
                      background: esVirtual ? 'var(--color-primary)' : 'transparent',
                      color: esVirtual ? '#fff' : 'var(--color-text-dim)',
                    }}
                  >
                    {t('eventRemote').toUpperCase()}
                  </button>
                </div>
              ) : (
                <div style={{ fontWeight: '700' }}>{esVirtual ? t('eventRemote') : t('eventInPerson')}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {esVirtual ? <Link2 size={14} /> : <MapPin size={14} />}
                {esVirtual ? t('eventLinkLabel').toUpperCase() : t('eventLocation').toUpperCase()}
              </label>
              {esDuenio ? (
                esVirtual ? (
                  <input
                    className="form-input"
                    value={form.url_reunion}
                    onChange={(e) => setForm({ ...form, url_reunion: e.target.value })}
                    placeholder={t('eventLinkPlaceholder')}
                  />
                ) : (
                  <input
                    className="form-input"
                    value={form.ubicacion}
                    onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                    placeholder={t('eventLocationPlaceholder')}
                  />
                )
              ) : (
                <div style={{ fontWeight: '700', wordBreak: 'break-word' }}>
                  {esVirtual ? (form.url_reunion || t('taskNoDescription')) : (form.ubicacion || t('taskNoDescription'))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ letterSpacing: '0.05em' }}>
                {esVirtual ? t('eventInstructions').toUpperCase() : t('eventLogistics').toUpperCase()}
              </label>
              {esDuenio ? (
                <textarea
                  className="form-input"
                  style={{ minHeight: '90px', resize: 'vertical', padding: '1rem 1.25rem' }}
                  value={form.instrucciones_acceso}
                  onChange={(e) => setForm({ ...form, instrucciones_acceso: e.target.value })}
                  placeholder={esVirtual ? t('eventVirtualAccessPlaceholder') : t('eventInPersonAccessPlaceholder')}
                />
              ) : (
                <div style={{ fontSize: '0.95rem', color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
                  {form.instrucciones_acceso || t('taskNoDescription')}
                </div>
              )}
            </div>

            {esDuenio && !esVirtual && (
              <div className="form-group">
                <label className="form-label" style={{ letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Video size={14} />
                  {t('eventOptionalLink').toUpperCase()}
                </label>
                <input
                  className="form-input"
                  value={form.url_reunion}
                  onChange={(e) => setForm({ ...form, url_reunion: e.target.value })}
                  placeholder={t('eventOptionalRemotePlaceholder')}
                />
              </div>
            )}
          </div>

          <TaskAttachments
            tareaId={evento?.id}
            type="agenda"
            title="Documentos del evento"
            pendingFiles={archivos}
            onPendingFilesChange={setArchivos}
            showUploader={esDuenio}
            showExisting={Boolean(evento?.id)}
            uploadLabel={evento ? 'Agregar archivos' : 'Seleccionar archivos'}
          />

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: '0.5rem 0' }} />

          {esDuenio && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'var(--color-surface-2)', borderRadius: '1.5rem', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgb(var(--brand-600) / 0.1)', borderRadius: '12px' }}>
                  <Users size={22} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: '900', fontSize: '1rem', letterSpacing: '-0.01em' }}>{t('eventCollaboration')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', fontWeight: '500' }}>{t('eventCollaborationDesc')}</div>
                </div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                <input type="checkbox" checked={form.es_compartido} onChange={(e) => setForm({ ...form, es_compartido: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} disabled={!esDuenio} />
                <span className="slider" style={{ position: 'absolute', cursor: esDuenio ? 'pointer' : 'default', top: 0, left: 0, right: 0, bottom: 0, background: form.es_compartido ? 'var(--color-primary)' : '#cbd5e1', transition: '.4s', borderRadius: '34px' }}>
                  <span style={{ position: 'absolute', height: '20px', width: '20px', left: form.es_compartido ? '26px' : '4px', bottom: '4px', background: 'white', transition: '.4s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                </span>
              </label>
            </div>
          )}

          {esDuenio && form.es_compartido && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', border: '1px solid var(--color-border)', borderRadius: '1.5rem', background: 'var(--color-surface)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg-base)', padding: '0.5rem', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, es_global: true, invitados_ids: [] })}
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    background: form.es_global ? 'var(--color-primary)' : 'transparent',
                    color: form.es_global ? '#fff' : 'var(--color-text-dim)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: form.es_global ? '0 4px 12px rgb(var(--brand-600) / 0.3)' : 'none',
                  }}
                >
                  {t('eventAllTeam').toUpperCase()}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, es_global: false })}
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    background: !form.es_global ? 'var(--color-primary)' : 'transparent',
                    color: !form.es_global ? '#fff' : 'var(--color-text-dim)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: !form.es_global ? '0 4px 12px rgb(var(--brand-600) / 0.3)' : 'none',
                  }}
                >
                  {t('eventSpecificMembers').toUpperCase()}
                </button>
              </div>

              {!form.es_global ? (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--color-primary)', letterSpacing: '0.05em' }}>{t('eventSelectMembers').toUpperCase()}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', padding: '0.75rem', background: 'var(--color-bg-base)', borderRadius: '1.25rem', border: '1px solid var(--color-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                      {usuarios.length === 0 ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', textAlign: 'center', padding: '2rem' }}>{t('eventNoMembers')}</div>
                      ) : (
                        usuarios
                          .filter((u) => u.id !== usuario?.id)
                          .map((u) => (
                            <div
                              key={u.id}
                              onClick={() => togggleInvitado(u.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: form.invitados_ids.includes(u.id) ? 'var(--color-surface)' : 'transparent',
                                border: '1px solid',
                                borderColor: form.invitados_ids.includes(u.id) ? 'var(--color-primary)' : 'transparent',
                                boxShadow: form.invitados_ids.includes(u.id) ? 'var(--shadow-sm)' : 'none',
                              }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary) 0%, rgb(var(--brand-700)) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: '900', boxShadow: '0 4px 6px -1px rgb(var(--brand-600) / 0.2)' }}>
                                {u.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: form.invitados_ids.includes(u.id) ? 'var(--color-primary)' : 'var(--color-text)' }}>{u.nombre}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: '500' }}>{u.email}</div>
                              </div>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid', borderColor: form.invitados_ids.includes(u.id) ? 'var(--color-success)' : 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: form.invitados_ids.includes(u.id) ? 'var(--color-success)' : 'transparent', transition: 'all 0.2s' }}>
                                {form.invitados_ids.includes(u.id) && <Check size={14} color="#fff" strokeWidth={3} />}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {form.invitados_ids.map((id) => {
                      const u = usuarios.find((x) => x.id === id);
                      if (!u) return null;
                      return (
                        <div key={`chip-${id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.9rem', background: 'rgb(var(--brand-600) / 0.1)', color: 'var(--color-primary)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900', border: '1px solid rgb(var(--brand-600) / 0.2)' }}>
                          {u.nombre}
                          <X size={14} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => togggleInvitado(id)} />
                        </div>
                      );
                    })}
                  </div>

                  {form.invitados_ids.length > 0 && disponibilidad.length > 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '1rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <AlertTriangle size={16} /> {t('eventConflicts')} ({disponibilidad.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {disponibilidad.slice(0, 3).map((d, idx) => (
                          <div key={`disp-${d.id || idx}`} style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '600', paddingLeft: '0.5rem', borderLeft: '2px solid #b45309' }}>
                            {t('eventBusyFrom')} {new Date(d.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(d.fechaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '1.25rem', background: 'rgb(var(--brand-600) / 0.05)', borderRadius: '1.25rem', border: '1px dashed var(--color-primary)', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ padding: '0.5rem', background: 'var(--color-primary)', borderRadius: '10px', color: '#fff' }}>
                    <Globe size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: '900', marginBottom: '0.2rem' }}>{t('eventPublicLabel')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', opacity: 0.8, fontWeight: '500', lineHeight: 1.4 }}>
                      {t('eventPublicDesc')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingBottom: '1rem' }}>
            {evento && esDuenio && (
              <button
                type="button"
                onClick={() => onDelete(evento.id)}
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#f87171', width: '56px', height: '56px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
              >
                <Trash2 size={24} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '1.25rem', fontWeight: '800', fontSize: '0.9rem', color: 'var(--color-text-dim)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-surface-3)'; e.currentTarget.style.color = 'var(--color-text)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-dim)'; }}
            >
              {esDuenio ? t('cancel').toUpperCase() : t('close').toUpperCase()}
            </button>
            {esDuenio && (
              <button type="submit" disabled={cargando} className="btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '0.95rem', letterSpacing: '0.02em' }}>
                <Save size={20} /> {cargando ? t('saving').toUpperCase() : evento ? t('eventUpdateButton').toUpperCase() : t('eventCreateButton').toUpperCase()}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalEvento;
