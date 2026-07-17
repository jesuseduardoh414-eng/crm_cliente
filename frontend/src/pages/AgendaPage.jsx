import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  List,
  LayoutGrid,
  Columns,
  Settings,
  Mail,
  Users,
  X,
  Trash2,
  Edit2,
  Globe,
  Activity,
  CheckSquare,
  Repeat,
  MoreHorizontal,
} from 'lucide-react';
import { agendaService, tareasService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { veTodo } from '../utils/roles';
import { usePreferences } from '../context/PreferencesContext';
import ModalEvento from '../components/ModalEvento';
import ModalConfiguracionAgenda from '../components/ModalConfiguracionAgenda';

let googleScriptPromise = null;

const cargarGoogleIdentityScript = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const VISTAS = [
  { id: 'MES',    labelKey: 'agendaMonth', icon: <LayoutGrid size={16} /> },
  { id: 'SEMANA', labelKey: 'agendaWeek',  icon: <Columns size={16} /> },
  { id: 'DIA',    labelKey: 'agendaDay',   icon: <List size={16} /> },
];

const FILTROS_AGENDA = [
  { id: 'todo', labelKey: 'agendaAllTypes', color: '#0f172a', bg: 'var(--color-surface-3)' },
  { id: 'proyecto', labelKey: 'agendaProjects', color: 'var(--color-primary)', bg: 'rgb(var(--brand-600) / 0.10)' },
  { id: 'tarea',   labelKey: 'agendaTasks',    color: '#16a34a', bg: 'rgba(22,163,74,0.10)' },
  { id: 'evento',  labelKey: 'agendaEvents',   color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  { id: 'reunion', labelKey: 'agendaMeetings', color: '#db2777', bg: 'rgba(219,39,119,0.10)' },
];

const getDiasSemana = (locale) => {
  // Semana empieza Lunes. Ref: 2024-01-01 es Lunes.
  const base = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(1 + i);
    return d.toLocaleDateString(locale, { weekday: 'long' });
  }).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
};

const LABORALES_DEFAULT = [1, 2, 3, 4, 5];
const TIPOS_NO_LABORALES = ['festivo', 'vacacion', 'permiso'];
const COLOR_TAREA = '#16a34a';

const getLocale = () => document.documentElement.lang === 'en' ? 'en-US' : 'es-MX';

const formatFechaLarga = (date, locale) =>
  date.toLocaleDateString(locale || getLocale(), { month: 'long', year: 'numeric', day: 'numeric' });

const formatMesAnio = (date, locale) =>
  date.toLocaleDateString(locale || getLocale(), { month: 'long', year: 'numeric' });

const formatHora = (value, locale) =>
  new Date(value).toLocaleTimeString(locale || getLocale(), { hour: '2-digit', minute: '2-digit' });

const inicioDelDia = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const finDelDia = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getHoras = (start, end) => {
  const horas = [];
  for (let i = start; i <= end; i += 1) horas.push(`${String(i).padStart(2, '0')}:00`);
  return horas;
};

const horaDecimal = (value, fallback = 0) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours)) return fallback;
  return hours + (Number.isFinite(minutes) ? minutes / 60 : 0);
};

const getRangoLaboralBase = (configLaboral) => {
  const entrada = horaDecimal(configLaboral?.horaEntrada, 9);
  const salida = horaDecimal(configLaboral?.horaSalida, 18);
  const pareceTodoElDia = entrada <= 0 && salida >= 23;

  return {
    inicio: Math.floor(pareceTodoElDia ? 9 : entrada),
    finExclusivo: Math.ceil(pareceTodoElDia ? 18 : salida),
  };
};

const getRangoHorasVisible = (configLaboral, eventos = [], fechas = []) => {
  const rangoBase = getRangoLaboralBase(configLaboral);
  let inicio = rangoBase.inicio;
  let finExclusivo = rangoBase.finExclusivo;

  const keys = new Set(fechas.map((fecha) => getDateKey(fecha)));
  eventos.forEach((evento) => {
    if (evento.todoElDia || evento.tipo === 'tarea' || esBloqueProyecto(evento)) return;
    const start = new Date(evento.fechaInicio);
    const end = evento.fechaFin ? new Date(evento.fechaFin) : new Date(start.getTime() + 3600000);
    const touchesVisibleDate = keys.size === 0 || keys.has(getDateKey(start)) || keys.has(getDateKey(end));
    if (!touchesVisibleDate) return;

    inicio = Math.min(inicio, Math.floor(start.getHours() + start.getMinutes() / 60));
    finExclusivo = Math.max(finExclusivo, Math.ceil(end.getHours() + end.getMinutes() / 60));
  });

  inicio = Math.max(0, inicio);
  finExclusivo = Math.min(24, Math.max(inicio + 1, finExclusivo));
  return { inicio, fin: finExclusivo - 1 };
};

const normalizarConfigLaboral = (config) => ({
  diasLaborales: config?.diasLaborales || config?.dias_laborales || LABORALES_DEFAULT,
  horaEntrada: config?.horaEntrada || config?.hora_entrada || '09:00',
  horaSalida: config?.horaSalida || config?.hora_salida || '18:00',
  horaComidaInicio: config?.horaComidaInicio || config?.hora_comida_inicio || '14:00',
  horaComidaFin: config?.horaComidaFin || config?.hora_comida_fin || '15:00',
});

const getDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDiaEspecialKey = (dia) =>
  typeof dia?.fecha === 'string' ? dia.fecha.split('T')[0] : getDateKey(dia?.fecha);

const getDiaEspecial = (date, diasEspeciales = []) => {
  const dateKey = getDateKey(date);
  return diasEspeciales.find((dia) => getDiaEspecialKey(dia) === dateKey);
};

const getDiaSemanaLaboral = (date) => (date.getDay() === 0 ? 7 : date.getDay());

const getEstadoLaboral = (date, configLaboral, diasEspeciales = []) => {
  const diaSemana = getDiaSemanaLaboral(date);
  const diasLaborales = configLaboral?.diasLaborales || LABORALES_DEFAULT;
  const diaEspecial = getDiaEspecial(date, diasEspeciales);
  const esDiaEspecialNoLaboral = diaEspecial && TIPOS_NO_LABORALES.includes(diaEspecial.tipo);

  return {
    diaEspecial,
    esLaboral: diasLaborales.includes(diaSemana) && !esDiaEspecialNoLaboral,
    esDiaEspecialNoLaboral,
  };
};

const aFechaComparacion = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
};

const eventoOcurreEnFecha = (evento, date) => {
  const inicio = aFechaComparacion(evento.fechaInicio);
  const fin = aFechaComparacion(evento.fechaFin || evento.fechaInicio);
  const objetivo = aFechaComparacion(date);
  if (!inicio || !fin || !objetivo) return false;
  return objetivo.getTime() >= inicio.getTime() && objetivo.getTime() <= fin.getTime();
};

const esBloqueProyecto = (evento) =>
  typeof evento?.titulo === 'string' &&
  evento.titulo.trim().startsWith('Proyecto:');

const getTipoAgenda = (evento) => {
  if (evento?.tipo === 'tarea') return 'tarea';
  if (evento?.tipo === 'reunion') return 'reunion';
  if (evento?.tipo === 'proyecto' || esBloqueProyecto(evento)) return 'proyecto';
  return 'evento';
};

const getProyectoIdAgenda = (evento) => {
  const id = evento?.proyecto?.id || evento?.proyectoId || (getTipoAgenda(evento) === 'proyecto' ? evento?.origenId : null);
  return id ? String(id) : null;
};

const getProyectoNombreAgenda = (evento) => {
  if (evento?.proyecto?.nombre) return evento.proyecto.nombre;
  if (getTipoAgenda(evento) === 'proyecto') return String(evento?.titulo || '').replace(/^Proyecto:\s*/i, '').trim();
  return null;
};

const normalizarNombreProyecto = (nombre) => String(nombre || '').trim().toLowerCase();

const agendaItemPerteneceAProyecto = (evento, proyectoSeleccionado) => {
  if (!proyectoSeleccionado) return true;
  const itemProjectId = getProyectoIdAgenda(evento);
  const itemProjectName = normalizarNombreProyecto(getProyectoNombreAgenda(evento));

  return (
    (itemProjectId && proyectoSeleccionado.ids?.includes(itemProjectId)) ||
    (itemProjectName && itemProjectName === proyectoSeleccionado.key)
  );
};

const tareaOcurreEnFecha = (tarea, date, configLaboral, diasEspeciales) => {
  if (!eventoOcurreEnFecha(tarea, date)) return false;

  const fin = aFechaComparacion(tarea.fechaFin || tarea.fechaInicio);
  const inicio = aFechaComparacion(tarea.fechaInicio);
  const objetivo = aFechaComparacion(date);
  if (!fin || !objetivo) return false;
  if (inicio && getDateKey(inicio) === getDateKey(objetivo)) return true;
  if (getDateKey(fin) === getDateKey(objetivo)) return true;

  return getEstadoLaboral(objetivo, configLaboral, diasEspeciales).esLaboral;
};

const itemAgendaOcurreEnFecha = (evento, date, configLaboral, diasEspeciales) =>
  evento?.tipo === 'tarea'
    ? tareaOcurreEnFecha(evento, date, configLaboral, diasEspeciales)
    : eventoOcurreEnFecha(evento, date);

const dedupeAgendaItems = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.tipoVista || item.tipo || 'item'}-${item.proyecto?.id || item.origenId || item.id || item.tituloVista || item.titulo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const restarIntervalos = (base, ocupados) => {
  let libres = [...base];
  ocupados.forEach((ocupado) => {
    libres = libres.flatMap((libre) => {
      if (ocupado.end <= libre.start || ocupado.start >= libre.end) return [libre];
      const partes = [];
      if (ocupado.start > libre.start) partes.push({ start: libre.start, end: ocupado.start });
      if (ocupado.end < libre.end) partes.push({ start: ocupado.end, end: libre.end });
      return partes;
    });
  });
  return libres.filter((libre) => libre.end - libre.start >= 8);
};

const distribuirEnHuecos = (items, huecos, altoTotal) => {
  if (!items.length) return new Map();

  const segmentos = huecos.length ? huecos : [{ start: 0, end: altoTotal }];
  const totalLibre = segmentos.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
  const slot = totalLibre / items.length;
  const height = Math.max(8, Math.min(30, slot - 3));
  const posiciones = new Map();

  items.forEach((item, index) => {
    const objetivo = index * slot + 1.5;
    let acumulado = 0;
    let elegido = segmentos[segmentos.length - 1];
    let offset = 0;

    for (const segmento of segmentos) {
      const largo = segmento.end - segmento.start;
      if (objetivo <= acumulado + largo) {
        elegido = segmento;
        offset = objetivo - acumulado;
        break;
      }
      acumulado += largo;
    }

    const top = Math.min(elegido.start + offset, elegido.end - height);
    posiciones.set(item.id, { top: Math.max(elegido.start, top), height });
  });

  return posiciones;
};

const getRangoConsulta = (date, view) => {
  if (view === 'DIA') {
    return { inicio: inicioDelDia(date), fin: finDelDia(date) };
  }

  if (view === 'SEMANA') {
    const start = new Date(date);
    const day = start.getDay();
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
    return {
      inicio: inicioDelDia(start),
      fin: finDelDia(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)),
    };
  }

  return {
    inicio: inicioDelDia(new Date(date.getFullYear(), date.getMonth(), 1)),
    fin: finDelDia(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
};

const getHoraInicial = () => 0;
const getHoraFinal = () => 23;
const sumarDias = (value, days) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date;
};

const moverFechaComoDia = (value, days) => {
  const date = sumarDias(value, days);
  return date ? getDateKey(date) : null;
};

const moverFechaHora = (value, days) => {
  const date = sumarDias(value, days);
  return date ? date.toISOString() : null;
};

const moverFechaTodoElDiaIso = (value, days, endOfDay = false) => {
  const date = sumarDias(value, days);
  if (!date) return null;
  date.setHours(endOfDay ? 23 : 12, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date.toISOString();
};

const getTaskNumericId = (taskLike) => {
  const rawId = String(taskLike?.id || '');
  const match = rawId.match(/tarea-(\d+)/i);
  if (match) return Number(match[1]);
  const numeric = Number(rawId);
  return Number.isFinite(numeric) ? numeric : null;
};

const getEventNumericId = (eventLike) => {
  const rawId = eventLike?.esOcurrencia ? eventLike?.eventoBaseId : eventLike?.id;
  return rawId ? String(rawId) : null;
};

const getDayDiff = (from, to) => {
  const start = aFechaComparacion(from);
  const end = aFechaComparacion(to);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
};

const desplazarDiasPatronSemanal = (patronRaw, dias) => {
  if (!patronRaw) return null;
  let patron = patronRaw;
  if (typeof patronRaw === 'string') {
    try {
      patron = JSON.parse(patronRaw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(patron?.dias)) return patron;

  const offset = ((dias % 7) + 7) % 7;
  return {
    ...patron,
    dias: patron.dias.map((dia) => (dia + offset) % 7),
  };
};

const getAgendaItemStableKey = (item) => `${item?.tipo || 'evento'}-${item?.esOcurrencia ? item?.eventoBaseId : item?.id}-${item?.fechaInicio || ''}`;
const getAgendaItemIdentity = (item) => `${item?.tipo || 'evento'}-${item?.esOcurrencia ? item?.eventoBaseId : item?.id}`;

const agendaItemMatchesIdentity = (item, identity) => getAgendaItemIdentity(item) === identity;

const moverItemAgendaLocal = (item, dias) => ({
  ...item,
  fechaInicio: item.tipo === 'tarea'
    ? moverFechaComoDia(item.fechaInicio, dias)
    : item.todoElDia
      ? moverFechaTodoElDiaIso(item.fechaInicio, dias)
      : moverFechaHora(item.fechaInicio, dias),
  fechaFin: item.fechaFin
    ? (item.tipo === 'tarea'
      ? moverFechaComoDia(item.fechaFin, dias)
      : item.todoElDia
        ? moverFechaTodoElDiaIso(item.fechaFin, dias, true)
        : moverFechaHora(item.fechaFin, dias))
    : null,
  patronRecurrencia: item.patronRecurrencia ? desplazarDiasPatronSemanal(item.patronRecurrencia, dias) : item.patronRecurrencia,
});

const AgendaPage = () => {
  const { t, locale } = usePreferences();
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('MES');
  const [eventos, setEventos] = useState([]);
  const [invitaciones, setInvitaciones] = useState([]);
  const [configLaboral, setConfigLaboral] = useState(normalizarConfigLaboral(null));
  const [diasEspeciales, setDiasEspeciales] = useState([]);
  const [googleCalendar, setGoogleCalendar] = useState({
    configured: false,
    connected: false,
    email: null,
    clientId: null,
    scope: '',
  });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfigOpen, setModalConfigOpen] = useState(false);
  const [showInvitaciones, setShowInvitaciones] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [agendaFilterType, setAgendaFilterType] = useState('todo');
  const [agendaProjectFilter, setAgendaProjectFilter] = useState('todos');
  // Consejo y mesa ven la agenda de conjunto y no necesitan los bloques de obra.
  const ocultarBloquesProyecto = veTodo(usuario);
  const agendaProjectOptions = useMemo(() => {
    const projects = new Map();

    eventos.forEach((evento) => {
      const tipo = getTipoAgenda(evento);
      if (tipo !== 'proyecto' && tipo !== 'tarea' && !evento?.proyecto?.id) return;

      const id = getProyectoIdAgenda(evento);
      const nombre = getProyectoNombreAgenda(evento);
      const key = normalizarNombreProyecto(nombre);
      if (!key || !nombre) return;

      const existente = projects.get(key);
      if (!existente) {
        projects.set(key, { id: key, key, nombre, ids: id ? [id] : [] });
      } else if (id && !existente.ids.includes(id)) {
        projects.set(key, { ...existente, ids: [...existente.ids, id] });
      }
    });

    return [...projects.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [eventos]);
  const selectedAgendaProject = useMemo(
    () => agendaProjectOptions.find((project) => project.id === agendaProjectFilter) || null,
    [agendaProjectFilter, agendaProjectOptions]
  );

  const eventosVisibles = useMemo(
    () => eventos.filter((evento) => {
      const tipo = getTipoAgenda(evento);
      if (ocultarBloquesProyecto && tipo === 'proyecto') return false;
      if (agendaFilterType !== 'todo' && tipo !== agendaFilterType) return false;
      if (agendaProjectFilter !== 'todos') {
        return agendaItemPerteneceAProyecto(evento, selectedAgendaProject);
      }
      return true;
    }),
    [agendaFilterType, agendaProjectFilter, eventos, ocultarBloquesProyecto, selectedAgendaProject]
  );

  useEffect(() => {
    if (
      agendaProjectFilter !== 'todos' &&
      !agendaProjectOptions.some((project) => project.id === agendaProjectFilter)
    ) {
      setAgendaProjectFilter('todos');
    }
  }, [agendaProjectFilter, agendaProjectOptions]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const fechaParam = searchParams.get('fecha');
    if (!fechaParam) return;

    const fechaDestino = new Date(fechaParam);
    if (Number.isNaN(fechaDestino.getTime())) return;

    setCurrentDate(fechaDestino);
  }, [searchParams]);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const mes = currentDate.getMonth() + 1;
      const anio = currentDate.getFullYear();
      const rango = getRangoConsulta(currentDate, view);

      const [resEventos, resInvitaciones, resConfig, resDias, resGoogle] = await Promise.all([
        agendaService.listar(rango.inicio.toISOString(), rango.fin.toISOString()),
        agendaService.invitacionesPendientes(),
        agendaService.getConfigLaboral(),
        agendaService.listarDiasEspeciales(mes, anio),
        agendaService.getGoogleCalendarStatus(),
      ]);

      setEventos(resEventos.eventos || []);
      setInvitaciones(resInvitaciones.invitaciones || resInvitaciones.pendientes || []);
      setConfigLaboral(normalizarConfigLaboral(resConfig.config));
      setDiasEspeciales(resDias.dias || []);
      setGoogleCalendar({
        configured: !!resGoogle.configured,
        connected: !!resGoogle.connected,
        email: resGoogle.email || null,
        clientId: resGoogle.clientId || null,
        scope: resGoogle.scope || '',
      });
    } catch (error) {
      showToast(error.message || 'Error al cargar la agenda', 'error');
    } finally {
      setCargando(false);
    }
  }, [currentDate, showToast, view]);

  const cargarEventosAgenda = useCallback(async () => {
    const rango = getRangoConsulta(currentDate, view);
    const resEventos = await agendaService.listar(rango.inicio.toISOString(), rango.fin.toISOString());
    return resEventos.eventos || [];
  }, [currentDate, view]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    const eventoIdParam = searchParams.get('evento');
    if (!eventoIdParam || !eventos.length) return;

    const eventoObjetivo = eventos.find((evento) => evento.id === eventoIdParam || evento.eventoBaseId === eventoIdParam);
    if (!eventoObjetivo) return;

    setSelectedEvent(eventoObjetivo);
    setPrefillData(null);
    setModalOpen(true);
  }, [eventos, searchParams]);

  const cerrarModalEvento = useCallback(() => {
    setModalOpen(false);
    setSelectedEvent(null);
    setPrefillData(null);

    if (searchParams.get('evento') || searchParams.get('fecha')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('evento');
      nextParams.delete('fecha');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let timeoutId = null;
    const handleScheduleChanged = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void cargarDatos();
      }, 150);
    };

    window.addEventListener('crm:schedule-changed', handleScheduleChanged);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('crm:schedule-changed', handleScheduleChanged);
    };
  }, [cargarDatos]);

  const nav = {
    next: () => {
      const d = new Date(currentDate);
      if (view === 'MES') d.setMonth(d.getMonth() + 1);
      else if (view === 'SEMANA') d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    },
    prev: () => {
      const d = new Date(currentDate);
      if (view === 'MES') d.setMonth(d.getMonth() - 1);
      else if (view === 'SEMANA') d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    },
    hoy: () => setCurrentDate(new Date()),
  };

  const handleResponder = async (eventoId, respuesta) => {
    try {
      await agendaService.responderInvitacion(eventoId, respuesta);
      showToast(`Invitacion ${respuesta === 'aceptado' ? 'aceptada' : 'rechazada'}`);
      cargarDatos();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('Eliminar este evento?')) return;
    try {
      await agendaService.eliminar(id);
      showToast('Evento eliminado');
      setModalOpen(false);
      cargarDatos();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleSelectFechaEvento = (datosFecha) => {
    setSelectedEvent(null);
    setPrefillData(datosFecha);
    setModalOpen(true);
  };

  const handleSelectFechaMes = handleSelectFechaEvento;

  const handleMoverBloqueTareas = useCallback(async (fechaBase, diasAMover) => {
    const dias = Number(diasAMover);
    if (!fechaBase || !Number.isInteger(dias) || dias <= 0) return false;

    const tareasAgenda = eventos.filter((evento) => evento.tipo === 'tarea');
    const tareasAMover = new Map();
    let cursor = aFechaComparacion(fechaBase);

    for (let i = 0; i < 120 && cursor; i += 1) {
      const tareasDelDia = tareasAgenda.filter((tarea) => itemAgendaOcurreEnFecha(tarea, cursor, configLaboral, diasEspeciales));
      if (tareasDelDia.length === 0) break;

      tareasDelDia.forEach((tarea) => {
        const taskId = getTaskNumericId(tarea);
        if (!taskId) return;
        tareasAMover.set(taskId, tarea);
      });

      cursor = sumarDias(cursor, 1);
    }

    if (tareasAMover.size === 0) {
      showToast('No se encontraron tareas para mover en este bloque.', 'info');
      return false;
    }

    try {
      await Promise.all(
        [...tareasAMover.values()].map((tarea) =>
          tareasService.editar(getTaskNumericId(tarea), {
            fechaInicio: moverFechaComoDia(tarea.fechaInicio, dias),
            venceEn: moverFechaComoDia(tarea.fechaFin || tarea.fechaInicio, dias),
          })
        )
      );

      showToast(t('agendaTaskMoveSuccess', {
        count: tareasAMover.size,
        taskLabel: tareasAMover.size === 1 ? t('projectTaskSingular') : t('projectTaskPlural'),
        days: dias,
        dayLabel: dias === 1 ? t('taskDaySingular') : t('taskDayPlural'),
      }));
      await cargarDatos();
      return true;
    } catch (error) {
      showToast(error.message || 'No se pudieron mover las tareas.', 'error');
      return false;
    }
  }, [cargarDatos, configLaboral, diasEspeciales, eventos, showToast]);

  const moverTareaAgenda = useCallback(async (tarea, dias) => {
    const taskId = getTaskNumericId(tarea);
    if (!taskId) return;

    await tareasService.editar(taskId, {
      fechaInicio: moverFechaComoDia(tarea.fechaInicio, dias),
      venceEn: moverFechaComoDia(tarea.fechaFin || tarea.fechaInicio, dias),
    });
  }, []);

  const moverEventoAgenda = useCallback(async (evento, dias) => {
    const eventId = getEventNumericId(evento);
    if (!eventId) return;

    const patronRecurrente = desplazarDiasPatronSemanal(evento.patronRecurrencia, dias);
    const esRecurrente = !!(evento.esRecurrente || evento.esOcurrencia || evento.patronRecurrencia);

    await agendaService.editar(eventId, {
      fecha_inicio: evento.todoElDia ? moverFechaTodoElDiaIso(evento.fechaInicio, dias) : moverFechaHora(evento.fechaInicio, dias),
      fecha_fin: evento.fechaFin
        ? (evento.todoElDia ? moverFechaTodoElDiaIso(evento.fechaFin, dias, true) : moverFechaHora(evento.fechaFin, dias))
        : null,
      todo_el_dia: !!evento.todoElDia,
      tipo: evento.tipo,
      es_recurrente: esRecurrente,
      patron_recurrencia: esRecurrente ? patronRecurrente : undefined,
      fecha_fin_recurrencia: evento.fechaFinRecurr || undefined,
    });
  }, []);

  const obtenerBloqueTareasDesdeFecha = useCallback((fechaBase) => {
    const tareasAgenda = eventos.filter((evento) => evento.tipo === 'tarea');
    const tareasAMover = new Map();
    let cursor = aFechaComparacion(fechaBase);

    for (let i = 0; i < 120 && cursor; i += 1) {
      const tareasDelDia = tareasAgenda.filter((tarea) => itemAgendaOcurreEnFecha(tarea, cursor, configLaboral, diasEspeciales));
      if (tareasDelDia.length === 0) break;

      tareasDelDia.forEach((tarea) => {
        const taskId = getTaskNumericId(tarea);
        if (!taskId) return;
        tareasAMover.set(taskId, tarea);
      });

      cursor = sumarDias(cursor, 1);
    }

    return [...tareasAMover.values()];
  }, [configLaboral, diasEspeciales, eventos]);

  const aplicarCambioOptimistaAgenda = useCallback(async ({ construirSiguienteEstado, ejecutarCambio, mensajeExito, mensajeError, verificar }) => {
    const estadoAnterior = eventos;
    const estadoSiguiente = construirSiguienteEstado(estadoAnterior);
    setEventos(estadoSiguiente);

    try {
      await ejecutarCambio();
      const eventosActualizados = await cargarEventosAgenda();
      if (verificar && !verificar(eventosActualizados)) {
        setEventos(estadoAnterior);
        showToast('El servidor no guardo el movimiento. Intentalo de nuevo.', 'error');
        return false;
      }
      setEventos(eventosActualizados);
      showToast(mensajeExito);
      void cargarDatos();
      return true;
    } catch (error) {
      setEventos(estadoAnterior);
      showToast(error.message || mensajeError, 'error');
      return false;
    }
  }, [cargarDatos, cargarEventosAgenda, eventos, showToast]);

  const handleMoverBloqueTareasDelta = useCallback(async (fechaBase, diasAMover) => {
    const dias = Number(diasAMover);
    if (!fechaBase || !Number.isInteger(dias) || dias === 0) return false;

    const tareasAMover = obtenerBloqueTareasDesdeFecha(fechaBase);
    if (tareasAMover.length === 0) {
      showToast('No se encontraron tareas para mover en este bloque.', 'info');
      return false;
    }

    const keys = new Set(tareasAMover.map((tarea) => getAgendaItemStableKey(tarea)));
    const identities = new Set(tareasAMover.map(getAgendaItemIdentity));
    const destino = sumarDias(fechaBase, dias);
    return aplicarCambioOptimistaAgenda({
      construirSiguienteEstado: (estadoAnterior) => estadoAnterior.map((evento) => (
        keys.has(getAgendaItemStableKey(evento)) ? moverItemAgendaLocal(evento, dias) : evento
      )),
      ejecutarCambio: () => Promise.all(tareasAMover.map((tarea) => moverTareaAgenda(tarea, dias))),
      verificar: (eventosActualizados) => destino && [...identities].every((identity) =>
        eventosActualizados.some((evento) =>
          agendaItemMatchesIdentity(evento, identity) &&
          itemAgendaOcurreEnFecha(evento, destino, configLaboral, diasEspeciales)
        )
      ),
      mensajeExito: t('agendaTaskMoveSuccess', {
        count: tareasAMover.length,
        taskLabel: tareasAMover.length === 1 ? t('projectTaskSingular') : t('projectTaskPlural'),
        days: Math.abs(dias),
        dayLabel: Math.abs(dias) === 1 ? t('taskDaySingular') : t('taskDayPlural'),
      }),
      mensajeError: t('agendaTaskMoveError'),
    });
  }, [aplicarCambioOptimistaAgenda, configLaboral, diasEspeciales, moverTareaAgenda, obtenerBloqueTareasDesdeFecha]);

  const handleMoverItemAgenda = useCallback(async (item, diasAMover) => {
    const dias = Number(diasAMover);
    if (!item || !Number.isInteger(dias) || dias === 0) return false;

    if (item.tipoVista !== 'tarea' && item.tipoVista !== 'evento' && item.tipoVista !== 'reunion') {
      return false;
    }

    const itemKey = getAgendaItemStableKey(item);
    const identity = getAgendaItemIdentity(item);
    const destino = sumarDias(item.fechaInicio, dias);
    return aplicarCambioOptimistaAgenda({
      construirSiguienteEstado: (estadoAnterior) => estadoAnterior.map((evento) => (
        getAgendaItemStableKey(evento) === itemKey ? moverItemAgendaLocal(evento, dias) : evento
      )),
      ejecutarCambio: () => {
        if (item.tipoVista === 'tarea') return moverTareaAgenda(item, dias);
        return moverEventoAgenda(item, dias);
      },
      verificar: (eventosActualizados) => destino && eventosActualizados.some((evento) =>
        agendaItemMatchesIdentity(evento, identity) &&
        itemAgendaOcurreEnFecha(evento, destino, configLaboral, diasEspeciales)
      ),
      mensajeExito: `${item.tipoVista === 'tarea' ? 'Tarea' : item.tipoVista === 'reunion' ? 'Reunion' : 'Evento'} movido ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}.`,
      mensajeError: t('agendaElementMoveError'),
    });
  }, [aplicarCambioOptimistaAgenda, configLaboral, diasEspeciales, moverEventoAgenda, moverTareaAgenda]);

  const handleMoverGrupoAgenda = useCallback(async ({ sourceDate, targetDate, groupType }) => {
    const dias = getDayDiff(sourceDate, targetDate);
    if (!dias) return false;

    if (groupType === 'tarea-group') {
      return handleMoverBloqueTareasDelta(sourceDate, dias);
    }

    const sourceDay = new Date(sourceDate);
    const itemsDelDia = eventos.filter((evento) => {
      if (groupType === 'evento-group') {
        return (evento.tipo || 'evento') !== 'reunion'
          && evento.tipo !== 'tarea'
          && itemAgendaOcurreEnFecha(evento, sourceDay, configLaboral, diasEspeciales)
          && !esBloqueProyecto(evento);
      }
      if (groupType === 'reunion-group') {
        return evento.tipo === 'reunion' && itemAgendaOcurreEnFecha(evento, sourceDay, configLaboral, diasEspeciales);
      }
      return false;
    });

    if (!itemsDelDia.length) {
      showToast(t('agendaItemMoveNone'), 'info');
      return false;
    }

    const keys = new Set(itemsDelDia.map((item) => getAgendaItemStableKey(item)));
    const identities = new Set(itemsDelDia.map(getAgendaItemIdentity));
    const destino = new Date(targetDate);
    return aplicarCambioOptimistaAgenda({
      construirSiguienteEstado: (estadoAnterior) => estadoAnterior.map((evento) => (
        keys.has(getAgendaItemStableKey(evento)) ? moverItemAgendaLocal(evento, dias) : evento
      )),
      ejecutarCambio: () => Promise.all(itemsDelDia.map((item) => moverEventoAgenda(item, dias))),
      verificar: (eventosActualizados) => [...identities].every((identity) =>
        eventosActualizados.some((evento) =>
          agendaItemMatchesIdentity(evento, identity) &&
          itemAgendaOcurreEnFecha(evento, destino, configLaboral, diasEspeciales)
        )
      ),
      mensajeExito: t('agendaItemMoveSuccess', {
        count: itemsDelDia.length,
        itemLabel: itemsDelDia.length === 1 ? t('agendaItemEventSingular') : t('agendaItemEventPlural'),
      }),
      mensajeError: t('agendaItemMoveError'),
    });
  }, [aplicarCambioOptimistaAgenda, configLaboral, diasEspeciales, eventos, handleMoverBloqueTareasDelta, moverEventoAgenda]);

  const handleConnectGoogle = async () => {
    if (!googleCalendar.clientId) {
      showToast('Falta configurar GOOGLE_CLIENT_ID en el backend.', 'error');
      return;
    }

    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      showToast('Falta VITE_GOOGLE_CLIENT_ID en el frontend.', 'error');
      return;
    }

    setGoogleLoading(true);
    try {
      const google = await cargarGoogleIdentityScript();
      await new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initCodeClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: googleCalendar.scope,
          ux_mode: 'popup',
          callback: async (response) => {
            if (!response?.code) {
              reject(new Error('No se recibio el codigo de Google'));
              return;
            }

            try {
              const res = await agendaService.connectGoogleCalendar(response.code);
              setGoogleCalendar((prev) => ({
                ...prev,
                connected: true,
                email: res.email || prev.email,
              }));
              showToast(t('agendaGoogleConnected'));
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          error_callback: () => reject(new Error('No se pudo completar la autorizacion con Google')),
        });

        client.requestCode();
      });
    } catch (error) {
      showToast(error.message || t('agendaGoogleConnectError'), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGoogleLoading(true);
    try {
      await agendaService.disconnectGoogleCalendar();
      setGoogleCalendar((prev) => ({
        ...prev,
        connected: false,
        email: null,
      }));
      showToast(t('agendaGoogleDisconnected'));
    } catch (error) {
      showToast(error.message || t('agendaGoogleDisconnectError'), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (cargando && !eventos.length) return <AgendaSkeleton />;

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMobile ? '1.75rem' : '3rem',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '2rem', flexWrap: isMobile ? 'wrap' : 'nowrap', flexShrink: 0 }}>
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0, width: isMobile ? 'auto' : '380px', whiteSpace: 'nowrap' }}>
            {view === 'MES' ? formatMesAnio(currentDate, locale).toUpperCase() : formatFechaLarga(currentDate, locale)}
          </h1>
          <div style={{ display: 'flex', background: 'var(--color-surface-2)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={nav.prev} className="btn-icon-sm" style={{ width: '28px', height: '28px' }}><ChevronLeft size={16} /></button>
              <button
                onClick={nav.hoy}
                style={{ padding: '0 0.8rem', fontSize: '0.7rem', fontWeight: '800', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}
              >
                {t('agendaToday')}
              </button>
              <button onClick={nav.next} className="btn-icon-sm" style={{ width: '28px', height: '28px' }}><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            onClick={googleCalendar.connected ? handleDisconnectGoogle : handleConnectGoogle}
            disabled={googleLoading || !googleCalendar.configured}
            title={
              googleCalendar.connected
                ? t('agendaGoogleConnectedWith', { email: googleCalendar.email || 'Google Calendar' })
                : t('agendaGoogleConnectTitle')
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 0.95rem',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: googleCalendar.connected ? 'rgba(16,185,129,0.28)' : 'var(--color-border)',
              background: googleCalendar.connected ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-2)',
              color: googleCalendar.connected ? '#047857' : 'var(--color-text)',
              fontSize: '0.78rem',
              fontWeight: '900',
              cursor: googleLoading || !googleCalendar.configured ? 'not-allowed' : 'pointer',
              opacity: googleLoading || !googleCalendar.configured ? 0.65 : 1,
              boxShadow: googleCalendar.connected ? '0 10px 24px rgba(16,185,129,0.10)' : 'none',
            }}
          >
            <Globe size={16} />
            {googleLoading
              ? (googleCalendar.connected ? t('projectsDisconnecting') : t('projectsConnecting'))
              : googleCalendar.connected
                ? (isMobile ? 'Google' : t('projectsConnectedGoogle'))
                : (isMobile ? 'Google' : t('projectsConnectGoogle'))}
          </button>

          <button
            onClick={() => setShowInvitaciones(!showInvitaciones)}
            style={{ position: 'relative', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', padding: '0.6rem', borderRadius: '10px', cursor: 'pointer' }}
          >
            <Mail size={18} color={invitaciones.length > 0 ? 'var(--color-primary)' : 'var(--color-text-dim)'} />
            {invitaciones.length > 0 && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--color-error)', color: '#fff', fontSize: '0.6rem', fontWeight: '900', padding: '1px 5px', borderRadius: '10px', border: '2px solid var(--color-surface)' }}>
                {invitaciones.length}
              </span>
            )}
          </button>

          {!isMobile && (
            <button
              onClick={() => setModalConfigOpen(true)}
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', padding: '0.6rem', borderRadius: '10px', cursor: 'pointer' }}
            >
              <Settings size={18} style={{ color: 'var(--color-text-dim)' }} />
            </button>
          )}

          <div style={{ display: 'flex', background: 'var(--color-surface-2)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
            {VISTAS.map((vista) => (
              <button
                key={vista.id}
                onClick={() => setView(vista.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: view === vista.id ? 'var(--color-primary)' : 'transparent',
                  color: view === vista.id ? '#ffffff' : 'var(--color-text-muted)',
                }}
              >
                {vista.icon} {!isMobile && t(vista.labelKey)}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setSelectedEvent(null);
              setPrefillData(null);
              setModalOpen(true);
            }}
            className="btn-primary"
            style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={18} /> {!isMobile && t('eventNew')}
          </button>
        </div>
      </div>

      {showInvitaciones && (
        <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: isMobile ? '100%' : '400px', background: 'var(--color-surface)', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', zIndex: 1100, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontWeight: '900', fontSize: '1.5rem' }}>{t('agendaInvitations')}</h2>
            <button onClick={() => setShowInvitaciones(false)} className="btn-icon-sm"><X size={20} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {invitaciones.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', marginTop: '2rem' }}>{t('notificationsEmpty')}</p>
            ) : (
              invitaciones.map((inv) => (
                <div key={inv.id} style={{ padding: '1.25rem', background: 'var(--color-surface-2)', borderRadius: '1.25rem', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: '800', marginBottom: '0.25rem' }}>{inv.evento.titulo}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: '1rem' }}>
                    {t('agendaOrganizer')} <b>{inv.evento.creador?.nombre}</b><br />
                    {new Date(inv.evento.fechaInicio).toLocaleString(locale)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleResponder(inv.evento.id, 'aceptado')} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', background: 'var(--color-success)', color: '#fff', fontWeight: '800', cursor: 'pointer', fontSize: '0.75rem' }}>{t('agendaAcceptInvitation').toUpperCase()}</button>
                    <button onClick={() => handleResponder(inv.evento.id, 'rechazado')} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', fontWeight: '800', cursor: 'pointer', fontSize: '0.75rem' }}>{t('agendaRejectInvitation').toUpperCase()}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: isMobile ? '0.9rem' : '1.1rem 1.25rem',
          marginBottom: '1.25rem',
          borderRadius: '1.35rem',
          border: '1px solid var(--color-border)',
          boxShadow: '0 16px 38px rgba(15,23,42,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
              {t('agendaCalendarFilters')}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.2rem' }}>
              {agendaProjectFilter === 'todos'
                ? t('agendaFilterFirstDesc')
                : t('agendaShowingContext', { project: agendaProjectOptions.find((project) => project.id === agendaProjectFilter)?.nombre || '' })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
            {FILTROS_AGENDA.map((filter) => {
              const active = agendaFilterType === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setAgendaFilterType(filter.id)}
                  style={{
                    border: '1px solid',
                    borderColor: active ? filter.color : '#dbe3ef',
                    background: active ? filter.color : filter.bg,
                    color: active ? '#fff' : filter.color,
                    borderRadius: '999px',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    boxShadow: active ? `0 10px 22px ${filter.color}22` : 'none',
                  }}
                >
                  {t(filter.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {(agendaFilterType === 'proyecto' || agendaFilterType === 'tarea' || agendaProjectFilter !== 'todos') && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eef2f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                  {t('agendaProjectFilterLabel')}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-dim)', marginTop: '0.12rem' }}>
                  {agendaFilterType === 'proyecto'
                    ? t('agendaChooseProjectRange')
                    : agendaFilterType === 'tarea'
                      ? t('agendaChooseProjectTasks')
                      : t('agendaProjectFilterContext')}
                </div>
              </div>
              {agendaProjectFilter !== 'todos' && (
                <button
                  type="button"
                  onClick={() => setAgendaProjectFilter('todos')}
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                    borderRadius: '999px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {t('agendaClearProject')}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.55rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setAgendaProjectFilter('todos')}
                style={{
                  flexShrink: 0,
                  border: '1px solid',
                  borderColor: agendaProjectFilter === 'todos' ? 'var(--color-text)' : '#dbe3ef',
                  background: agendaProjectFilter === 'todos' ? 'var(--color-text)' : 'var(--color-surface)',
                  color: agendaProjectFilter === 'todos' ? 'var(--color-surface)' : 'var(--color-text-dim)',
                  borderRadius: '999px',
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('agendaAllProjectsFilter')}
              </button>
              {agendaProjectOptions.map((project) => {
                const active = agendaProjectFilter === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setAgendaProjectFilter(project.id)}
                    style={{
                      flexShrink: 0,
                      border: '1px solid',
                      borderColor: active ? 'var(--color-primary)' : '#dbe3ef',
                      background: active ? 'rgb(var(--brand-600) / 0.12)' : 'var(--color-surface)',
                      color: active ? 'var(--color-primary)' : 'var(--color-text-dim)',
                      borderRadius: '999px',
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: active ? '0 10px 22px rgb(var(--brand-600) / 0.12)' : 'none',
                    }}
                  >
                    {project.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: view === 'MES' ? (isMobile ? '1rem' : '1.5rem') : '0', borderRadius: isMobile ? '1.2rem' : '2rem', overflow: view === 'MES' ? 'visible' : 'hidden', border: 'none', boxShadow: 'var(--shadow-xl)' }}>
        {view === 'MES' && (
          <VistaMensual
            date={currentDate}
            eventos={eventosVisibles}
            diasEspeciales={diasEspeciales}
            configLaboral={configLaboral}
            currentUserId={usuario?.id}
            isMobile={isMobile}
            ocultarBloquesProyecto={ocultarBloquesProyecto}
            onSelectEvent={(e) => {
              if (e.esLectura) return showToast(e.titulo, 'info');
              setSelectedEvent(e);
              setModalOpen(true);
            }}
            onSelectDate={handleSelectFechaMes}
            onMoveTaskBlock={handleMoverBloqueTareas}
            onMoveItem={handleMoverItemAgenda}
            onMoveGroup={handleMoverGrupoAgenda}
          />
        )}
        {view === 'SEMANA' && (
          <VistaSemanal
            date={currentDate}
            eventos={eventosVisibles}
            diasEspeciales={diasEspeciales}
            configLaboral={configLaboral}
            currentUserId={usuario?.id}
            isMobile={isMobile}
            ocultarBloquesProyecto={ocultarBloquesProyecto}
            onSelectEvent={(e) => {
              if (e.esLectura) return showToast(e.titulo, 'info');
              setSelectedEvent(e);
              setModalOpen(true);
            }}
            onSelectDate={handleSelectFechaEvento}
          />
        )}
        {view === 'DIA' && (
          <VistaDiaria
            date={currentDate}
            eventos={eventosVisibles}
            diasEspeciales={diasEspeciales}
            configLaboral={configLaboral}
            currentUserId={usuario?.id}
            isMobile={isMobile}
            ocultarBloquesProyecto={ocultarBloquesProyecto}
            onSelectEvent={(e) => {
              if (e.esLectura) return showToast(e.titulo, 'info');
              setSelectedEvent(e);
              setModalOpen(true);
            }}
            onSelectDate={handleSelectFechaEvento}
            onEliminar={handleEliminar}
          />
        )}
      </div>

      {modalOpen && (() => {
        const eventoParaEditar = selectedEvent?.esOcurrencia
          ? { ...selectedEvent, id: selectedEvent.eventoBaseId }
          : selectedEvent;

        return (
          <ModalEvento
            key={eventoParaEditar?.id || 'nuevo'}
            evento={eventoParaEditar}
            prefill={prefillData}
            onClose={cerrarModalEvento}
            onSave={() => {
              cerrarModalEvento();
              cargarDatos();
            }}
            onDelete={handleEliminar}
          />
        );
      })()}

      {modalConfigOpen && (
        <ModalConfiguracionAgenda
          onClose={() => {
            setModalConfigOpen(false);
            cargarDatos();
          }}
          showToast={showToast}
          initialData={{
            config: configLaboral,
            diasEspeciales,
            googleCalendar,
          }}
        />
      )}
    </div>
  );
};

const AgendaSkeleton = () => (
  <div className="page-container" style={{ padding: '2rem' }}>
    <div className="animate-pulse" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
      <div>
        <div style={{ width: '280px', height: '40px', borderRadius: '10px', background: 'var(--color-border)', marginBottom: '0.75rem' }} />
        <div style={{ width: '180px', height: '18px', borderRadius: '8px', background: 'var(--color-surface-3)' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--color-border)' }} />
        <div style={{ width: '180px', height: '44px', borderRadius: '12px', background: 'var(--color-border)' }} />
      </div>
    </div>

    <div className="card animate-pulse" style={{ padding: 0, borderRadius: '2rem', overflow: 'hidden', border: 'none', boxShadow: 'var(--shadow-xl)' }}>
      <div className="grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`head-${i}`} style={{ height: '58px', background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border-light)', borderRight: i < 6 ? '1px solid var(--color-border-light)' : 'none' }} />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} style={{ minHeight: '120px', padding: '0.75rem', background: 'var(--color-surface)', borderRight: (i + 1) % 7 ? '1px solid var(--color-border-light)' : 'none', borderBottom: '1px solid var(--color-border-light)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--color-border)', marginBottom: '1.5rem' }} />
            <div style={{ width: '70%', height: '10px', borderRadius: '999px', background: 'var(--color-surface-3)', marginBottom: '0.5rem' }} />
            <div style={{ width: '46%', height: '10px', borderRadius: '999px', background: '#f1f5f9' }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const VistaMensual = ({ date, eventos, diasEspeciales, configLaboral, isMobile, onSelectEvent, onSelectDate, onMoveItem, onMoveGroup, ocultarBloquesProyecto = false }) => {
  const { t, locale } = usePreferences();
  const diasSemana = getDiasSemana(locale);
  const [expandedDay, setExpandedDay] = useState(null);
  const [activeTaskMenu, setActiveTaskMenu] = useState(null);
  const [movingTasks, setMovingTasks] = useState(false);
  const [draggedGroup, setDraggedGroup] = useState(null);
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const ejecutarMovimiento = async (item, dias) => {
    if (!item || movingTasks || !onMoveItem) return;
    setMovingTasks(true);
    setActiveTaskMenu(null);
    const movido = await onMoveItem(item, dias);
    if (movido) setExpandedDay(null);
    setMovingTasks(false);
  };

  const pedirMovimientoPersonalizado = async () => {
    const value = window.prompt('Cuantos dias quieres mover este bloque de tareas?', '3');
    if (value === null) return;
    const dias = Number(value);
    if (!Number.isInteger(dias) || dias <= 0) return;
    await ejecutarMovimiento(dias);
  };

  const pedirMovimientoPersonalizadoItem = async (item) => {
    if (!item) return;
    const etiqueta = item.tipoVista === 'tarea' ? 'esta tarea' : item.tipoVista === 'reunion' ? 'esta reunion' : 'este evento';
    const value = window.prompt(`Mover ${etiqueta} cuántos días?`, '3');
    if (value === null) return;
    const dias = Number(value);
    if (!Number.isInteger(dias) || dias === 0) return;
    await ejecutarMovimiento(item, dias);
  };

  const dias = [];
  for (let i = 0; i < startOffset; i += 1) dias.push(null);
  for (let i = 1; i <= totalDays; i += 1) dias.push(i);

  return (
    <div className="grid grid-cols-7 gap-2.5 lg:gap-4">
      {diasSemana.map((diaSemana) => (
        <div key={diaSemana} className="pb-1 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {isMobile ? diaSemana.charAt(0) : diaSemana}
        </div>
      ))}

      {dias.map((dia, i) => {
        const dObj = dia ? new Date(year, month, dia) : null;
        const diaEventos = dia ? eventos.filter((evento) => itemAgendaOcurreEnFecha(evento, dObj, configLaboral, diasEspeciales) && !esBloqueProyecto(evento)) : [];
        const diaTareas = diaEventos.filter((evento) => evento.tipo === 'tarea');
        const diaEventosVisibles = diaEventos.filter((evento) => evento.tipo !== 'tarea');
        const diaReuniones = diaEventosVisibles.filter((evento) => evento.tipo === 'reunion');
        const diaEventosSolo = diaEventosVisibles.filter((evento) => evento.tipo !== 'reunion');
        const diaProyectos = dia && !ocultarBloquesProyecto
          ? eventos.filter((evento) => itemAgendaOcurreEnFecha(evento, dObj, configLaboral, diasEspeciales) && esBloqueProyecto(evento))
          : [];
        const diaEsp = dia ? getDiaEspecial(dObj, diasEspeciales) : null;
        const esHoy = dia === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        const { esLaboral } = dObj ? getEstadoLaboral(dObj, configLaboral, diasEspeciales) : { esLaboral: false };
        const circleBg = esHoy ? 'bg-brand-600' : '';
        const circleColor = esHoy ? 'text-white' : dia ? (esLaboral ? 'text-slate-600' : 'text-red-400') : 'text-slate-300';

        const proyectosModal = dia ? dedupeAgendaItems(
          diaProyectos.map((p) => ({ ...p, tipoVista: 'proyecto', tituloVista: (p.titulo || '').replace('Proyecto: ', '') }))
        ) : [];
        const tareasModal = dia ? dedupeAgendaItems(
          diaTareas.map((t) => ({ ...t, tipoVista: 'tarea', tituloVista: t.titulo.replace(/^TAREA:\s*/i, '') }))
        ) : [];
        const eventosModal = dia ? dedupeAgendaItems(
          diaEventosSolo.map((e) => ({ ...e, tipoVista: e.tipo || 'evento', tituloVista: e.titulo }))
        ) : [];
        const reunionesModal = dia ? dedupeAgendaItems(
          diaReuniones.map((e) => ({ ...e, tipoVista: 'reunion', tituloVista: e.titulo }))
        ) : [];

        const todosLosItems = dia ? [
          ...(proyectosModal.length > 0 ? [{
            id: 'proyectos-group',
            text: `${proyectosModal.length} ${proyectosModal.length > 1 ? t('teamProjectPlural') : t('teamProjectSingular')}`,
            count: proyectosModal.length,
            color: 'var(--color-primary)',
            bg: 'rgb(var(--brand-600) / 0.10)',
            type: 'proyecto-group',
          }] : []),
          ...(tareasModal.length > 0 ? [{
            id: 'tareas-group',
            text: `${tareasModal.length} ${tareasModal.length > 1 ? t('projectTaskPlural') : t('projectTaskSingular')}`,
            count: tareasModal.length,
            color: '#16a34a',
            bg: 'rgba(22,163,74,0.10)',
            type: 'tarea-group',
          }] : []),
          ...(eventosModal.length > 0 ? [{
            id: 'eventos-group',
            text: `${eventosModal.length} ${eventosModal.length > 1 ? t('agendaEvents') : t('eventTypeEvent')}`,
            count: eventosModal.length,
            color: '#7c3aed',
            bg: 'rgba(124,58,237,0.10)',
            type: 'evento-group',
          }] : []),
          ...(reunionesModal.length > 0 ? [{
            id: 'reuniones-group',
            text: `${reunionesModal.length} ${reunionesModal.length > 1 ? t('agendaMeetings') : t('eventTypeMeeting')}`,
            count: reunionesModal.length,
            color: '#db2777',
            bg: 'rgba(219,39,119,0.10)',
            type: 'reunion-group',
          }] : []),
        ] : [];

        const itemsParaModal = dia ? [
          ...proyectosModal,
          ...tareasModal,
          ...eventosModal,
          ...reunionesModal,
        ] : [];
        const itemsPorGrupo = {
          'proyecto-group': proyectosModal,
          'tarea-group': tareasModal,
          'evento-group': eventosModal,
          'reunion-group': reunionesModal,
        };

        return (
          <div
            key={i}
            onClick={() => {
              if (!dia) return;
              if (itemsParaModal.length > 0) {
                setActiveTaskMenu(null);
                setExpandedDay({ date: dObj, items: itemsParaModal });
              } else {
                onSelectDate({ fechaInicio: dObj });
              }
            }}
            onDragOver={(ev) => {
              if (!dia || !draggedGroup || !onMoveGroup) return;
              ev.preventDefault();
            }}
            onDrop={async (ev) => {
              if (!dia || !draggedGroup || !onMoveGroup) return;
              ev.preventDefault();
              ev.stopPropagation();
              setActiveTaskMenu(null);
              setMovingTasks(true);
              const movido = await onMoveGroup({
                sourceDate: draggedGroup.sourceDate,
                targetDate: dObj,
                groupType: draggedGroup.groupType,
              });
              if (movido) setExpandedDay(null);
              setDraggedGroup(null);
              setMovingTasks(false);
            }}
            className={`
              min-h-[90px] lg:min-h-[122px] p-2.5 lg:p-3 relative transition-colors rounded-[20px] border border-slate-200
              ${dia ? 'cursor-pointer hover:border-brand-200 hover:shadow-md' : 'bg-slate-50/70'}
            `}
            style={{
              background: dia
                ? (!esLaboral ? 'var(--color-surface-3)' : 'var(--color-surface)')
                : 'var(--color-surface-3)',
              boxShadow: esHoy
                ? 'inset 0 0 0 2px rgb(var(--brand-600) / 0.14), 0 10px 24px rgb(var(--brand-600) / 0.08)'
                : (diaProyectos.length ? 'inset 0 0 0 1px rgb(var(--brand-600) / 0.05)' : undefined),
              outline: draggedGroup && dia ? '1px dashed rgb(var(--brand-600) / 0.16)' : undefined,
            }}
          >
            {dia && (
              <>
                <div className="flex justify-between items-start mb-2">
                  <span className={`
                    min-w-6 h-6 lg:min-w-7 lg:h-7 px-1 flex items-center justify-center rounded-lg text-[10px] lg:text-xs font-black transition-all
                    ${circleBg} ${circleColor}
                    ${esHoy ? 'shadow-lg shadow-brand-500/30' : ''}
                  `}>
                    {dia}
                  </span>
                  {diaEsp && (
                    <div
                      className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full mt-1.5 mr-0.5"
                      style={{
                        background: diaEsp.tipo === 'festivo' ? '#ef4444' : diaEsp.tipo === 'vacacion' ? '#10b981' : diaEsp.tipo === 'homeoffice' ? 'var(--color-primary-light)' : '#f59e0b',
                      }}
                      title={diaEsp.descripcion}
                    />
                  )}
                </div>

                {diaEsp && (
                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: diaEsp.tipo === 'festivo' ? 'var(--color-accent-error)' : 'var(--color-primary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    {diaEsp.descripcion}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {(() => {
                    const MAX_ITEMS = 3;
                    const itemsMostrados = todosLosItems.slice(0, MAX_ITEMS);
                    const ocultos = todosLosItems.length - itemsMostrados.length;

                    return (
                      <>
                        {itemsMostrados.map(item => (
                          <div
                            key={item.id}
                            draggable={item.type !== 'proyecto-group'}
                            onDragStart={(ev) => {
                              if (!dia || item.type === 'proyecto-group') return;
                              ev.stopPropagation();
                              setDraggedGroup({
                                sourceDate: dObj,
                                groupType: item.type,
                              });
                              ev.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedGroup(null)}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setActiveTaskMenu(null);
                              setExpandedDay({ date: dObj, items: itemsPorGrupo[item.type] || [] });
                            }}
                            style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.35rem',
                              padding: '0.25rem 0.4rem', 
                              borderRadius: '7px', 
                              background: item.bg, 
                              color: item.color, 
                              fontSize: '0.55rem', 
                              fontWeight: '900',
                              borderLeft: `2px solid ${item.color}`,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer'
                            }}
                            title={item.text}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.text}</span>
                            <span style={{ flexShrink: 0 }}>{item.type === 'proyecto-group' ? t('agendaSeeMore') : t('agendaDrag')}</span>
                          </div>
                        ))}

                        {ocultos > 0 && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setActiveTaskMenu(null);
                              setExpandedDay({ date: dObj, items: itemsParaModal });
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '0.6rem',
                              color: 'var(--color-primary)',
                              fontWeight: '900',
                              padding: '0 0 0 4px',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            {t('agendaMoreItems', { count: ocultos })}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        );
      })}
      {expandedDay && (
        <div
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) {
              setActiveTaskMenu(null);
              setExpandedDay(null);
            }
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div style={{ width: '100%', maxWidth: '540px', maxHeight: '80vh', overflow: 'hidden', background: 'var(--color-surface)', borderRadius: '28px', boxShadow: '0 24px 70px rgba(15,23,42,0.22)' }}>
            <div style={{ padding: '1.35rem 1.6rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'var(--color-surface-3)' }}>
              <div>
                <h4 style={{ fontSize: '1.08rem', fontWeight: '900', color: 'var(--color-text)' }}>
                  {expandedDay.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: '800' }}>{t('agendaScheduled', { count: expandedDay.items.length })}</p>
              </div>
              <button type="button" onClick={() => { setActiveTaskMenu(null); setExpandedDay(null); }} className="btn-icon-sm"><X size={16} /></button>
            </div>
            <div style={{ padding: '1.2rem 1.6rem 1.6rem', maxHeight: 'calc(80vh - 92px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {expandedDay.items.map((item) => {
                const color = item.tipoVista === 'proyecto'
                  ? 'var(--color-primary)'
                  : item.tipoVista === 'tarea'
                    ? '#16a34a'
                    : item.tipoVista === 'reunion'
                      ? '#db2777'
                      : '#7c3aed';
                return (
                  <div
                    key={`${item.tipoVista}-${item.id}`}
                    type="button"
                    onClick={() => {
                      setActiveTaskMenu(null);
                      setExpandedDay(null);
                      if (item.tipoVista !== 'tarea' && item.tipoVista !== 'proyecto') onSelectEvent(item);
                    }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.95rem 1rem', borderRadius: '16px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: item.tipoVista === 'tarea' || item.tipoVista === 'proyecto' ? 'default' : 'pointer', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.85rem', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '900', color: 'var(--color-text)', lineHeight: 1.35, overflowWrap: 'anywhere', paddingRight: item.tipoVista === 'tarea' ? '0.5rem' : 0 }}>{item.tituloVista}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', color, background: `${color}14`, padding: '0.2rem 0.5rem', borderRadius: '999px' }}>{item.tipoVista}</span>
                        {(item.tipoVista === 'tarea' || item.tipoVista === 'evento' || item.tipoVista === 'reunion') && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setActiveTaskMenu((prev) => (prev === item.id ? null : item.id));
                            }}
                            disabled={movingTasks}
                            title="Mover solo este elemento"
                            style={{ width: '30px', height: '30px', borderRadius: '999px', border: '1px solid rgb(var(--brand-100))', background: activeTaskMenu === item.id ? 'rgb(var(--brand-600) / 0.12)' : 'var(--color-surface)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: movingTasks ? 'wait' : 'pointer' }}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '0.45rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: color }} />
                      {item.proyecto?.nombre || (item.todoElDia ? t('agendaAllDay') : `${formatHora(item.fechaInicio)} - ${formatHora(item.fechaFin || item.fechaInicio)}`)}
                    </div>
                    {(item.tipoVista === 'tarea' || item.tipoVista === 'evento' || item.tipoVista === 'reunion') && activeTaskMenu === item.id && (
                      <div
                        onClick={(ev) => ev.stopPropagation()}
                        style={{ position: 'absolute', top: '3rem', right: '1rem', minWidth: '180px', background: 'var(--color-surface)', border: '1px solid rgb(var(--brand-100))', borderRadius: '14px', boxShadow: '0 18px 40px rgba(15,23,42,0.14)', padding: '0.35rem', zIndex: 5 }}
                      >
                        <button type="button" onClick={() => ejecutarMovimiento(item, 1)} disabled={movingTasks} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '800', color: 'var(--color-text)', cursor: movingTasks ? 'wait' : 'pointer' }}>Mover +1 día</button>
                        <button type="button" onClick={() => ejecutarMovimiento(item, 2)} disabled={movingTasks} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '800', color: 'var(--color-text)', cursor: movingTasks ? 'wait' : 'pointer' }}>Mover +2 días</button>
                        <button type="button" onClick={() => pedirMovimientoPersonalizadoItem(item)} disabled={movingTasks} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '800', color: 'var(--color-text)', cursor: movingTasks ? 'wait' : 'pointer' }}>Elegir cantidad...</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VistaSemanal = ({ date, eventos, diasEspeciales, configLaboral, currentUserId, onSelectEvent, onSelectDate, ocultarBloquesProyecto = false }) => {
  const { locale } = usePreferences();
  const diasSemana = getDiasSemana(locale);
  const startOfWeek = useMemo(() => {
    const d = new Date(date);
    const day = d.getDay();
    return new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)));
  }, [date]);

  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const { inicio: hStart, fin: hEnd } = getRangoHorasVisible(configLaboral, eventos, semana);
  const horas = getHoras(hStart, hEnd);
  const eventosTodoElDiaPorDia = semana.map((d) => eventos.filter((e) => itemAgendaOcurreEnFecha(e, d, configLaboral, diasEspeciales) && e.todoElDia && e.tipo !== 'tarea' && !esBloqueProyecto(e)));
  const tareasPorDia = semana.map((d) => eventos.filter((e) => e.tipo === 'tarea' && itemAgendaOcurreEnFecha(e, d, configLaboral, diasEspeciales)));
  const proyectosPorDia = semana.map((d) => (
    ocultarBloquesProyecto
      ? []
      : eventos.filter((e) => itemAgendaOcurreEnFecha(e, d, configLaboral, diasEspeciales) && esBloqueProyecto(e))
  ));
  const altoGrid = horas.length * 50;
  const rangoBase = getRangoLaboralBase(configLaboral);
  const inicioLaboral = Math.max(hStart, rangoBase.inicio);
  const finLaboral = Math.min(hEnd + 1, rangoBase.finExclusivo);
  const topLaboral = Math.max(0, (inicioLaboral - hStart) * 50);
  const bottomLaboral = Math.min(altoGrid, (finLaboral - hStart) * 50);
  const rangoTareas = bottomLaboral > topLaboral
    ? [{ start: topLaboral, end: bottomLaboral }]
    : [{ start: 0, end: altoGrid }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <div style={{ width: '60px', borderRight: '1px solid var(--color-border)' }} />
        {semana.map((d, i) => {
          const { esLaboral, diaEspecial } = getEstadoLaboral(d, configLaboral, diasEspeciales);
          const esHoy = d.getDate() === new Date().getDate() && d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
          const tieneProyecto = proyectosPorDia[i].length > 0;
          const circleBg = esHoy ? 'var(--color-primary)' : esLaboral ? 'rgb(var(--brand-500) / 0.1)' : 'rgba(239, 68, 68, 0.1)';
          const circleColor = esHoy ? '#fff' : esLaboral ? 'var(--color-primary-light)' : '#ef4444';
          const labelColor = esHoy ? 'var(--color-primary-dark)' : circleColor;
          const headerBg = esHoy
            ? 'rgb(var(--brand-600) / 0.14)'
            : tieneProyecto
              ? 'rgb(var(--brand-600) / 0.055)'
              : !esLaboral
                ? 'rgba(239, 68, 68, 0.02)'
                : 'transparent';

          return (
            <div key={i} style={{ flex: 1, padding: '1rem', textAlign: 'center', borderRight: i < 6 ? '1px solid var(--color-border-light)' : 'none', background: headerBg, boxShadow: esHoy ? 'inset 0 -2px 0 rgb(var(--brand-600) / 0.35)' : 'none' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '900', color: labelColor }}>{diasSemana[i]?.toUpperCase()}</div>
              <div style={{ width: '32px', height: '32px', margin: '0.4rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '1.1rem', fontWeight: '900', background: circleBg, color: circleColor }}>
                {d.getDate()}
              </div>
              {!esLaboral && <div style={{ fontSize: '0.6rem', fontWeight: '800', color: '#ef4444' }}>{diaEspecial?.descripcion || 'NO LABORAL'}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
        <div style={{ width: '60px', borderRight: '1px solid var(--color-border)' }} />
        {semana.map((_, dayIdx) => (
          <div key={`all-day-${dayIdx}`} style={{ flex: 1, minHeight: '56px', padding: '0.5rem', borderRight: dayIdx < 6 ? '1px solid var(--color-border-light)' : 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {eventosTodoElDiaPorDia[dayIdx].slice(0, 2).map((evento) => (
              <div
                key={evento.id}
                onClick={() => onSelectEvent(evento)}
                style={{ fontSize: '0.68rem', fontWeight: '800', color: '#fff', background: evento.color, borderRadius: '8px', padding: '0.25rem 0.4rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {evento.titulo}
              </div>
            ))}
            {eventosTodoElDiaPorDia[dayIdx].length > 2 && (
              <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                + {eventosTodoElDiaPorDia[dayIdx].length - 2} mas
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', maxHeight: '600px', overflowY: 'auto' }}>
        <div style={{ width: '60px', borderRight: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
          {horas.map((h) => (
            <div key={h} style={{ height: '50px', padding: '0.5rem', fontSize: '0.65rem', fontWeight: '800', color: 'var(--color-text-dim)', textAlign: 'right', borderBottom: '1px solid var(--color-border-light)' }}>
              {h}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex' }}>
          {semana.map((d, dayIdx) => {
            const { esLaboral: esLaboralDia } = getEstadoLaboral(d, configLaboral, diasEspeciales);
            const esHoyDia = getDateKey(d) === getDateKey(new Date());
            const eventosConHora = eventos
              .filter((evento) => itemAgendaOcurreEnFecha(evento, d, configLaboral, diasEspeciales) && !evento.todoElDia && evento.tipo !== 'tarea' && !esBloqueProyecto(evento))
              .map((evento) => {
                const start = new Date(evento.fechaInicio);
                const end = evento.fechaFin ? new Date(evento.fechaFin) : new Date(start.getTime() + 3600000);
                const isStartDay = getDateKey(start) === getDateKey(d);
                const isEndDay = getDateKey(end) === getDateKey(d);
                const displayStart = isStartDay ? start.getHours() + start.getMinutes() / 60 : hStart;
                const displayEnd = isEndDay ? end.getHours() + end.getMinutes() / 60 : hEnd + 1;
                if (displayEnd <= hStart || displayStart >= hEnd + 1) return null;
                const top = (Math.max(displayStart, hStart) - hStart) * 50;
                const height = (Math.min(displayEnd, hEnd + 1) - Math.max(displayStart, hStart)) * 50;
                return { evento, top, height: Math.max(height, 20) };
              })
              .filter(Boolean);
            const huecosTareas = restarIntervalos(
              rangoTareas,
              eventosConHora.map(({ top, height }) => ({ start: Math.max(0, top - 4), end: Math.min(altoGrid, top + height + 4) }))
            );
            const posicionesTareas = distribuirEnHuecos(tareasPorDia[dayIdx], huecosTareas, altoGrid);
            const bgDia = esHoyDia
              ? 'rgb(var(--brand-600) / 0.08)'
              : proyectosPorDia[dayIdx].length
                ? 'rgb(var(--brand-600) / 0.055)'
                : !esLaboralDia
                  ? 'rgba(239, 68, 68, 0.03)'
                  : 'transparent';
            return (
              <div key={dayIdx} style={{ flex: 1, borderRight: dayIdx < 6 ? '1px solid var(--color-border-light)' : 'none', position: 'relative', background: bgDia }}>
                {horas.map((h) => {
                  const hour = parseInt(h, 10);
                  const isWork = configLaboral ? hour >= parseInt(configLaboral.horaEntrada, 10) && hour < parseInt(configLaboral.horaSalida, 10) : true;
                  const isLunch = configLaboral ? hour >= parseInt(configLaboral.horaComidaInicio, 10) && hour < parseInt(configLaboral.horaComidaFin, 10) : false;
                  const slotBg = isLunch ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.02) 5px, rgba(0,0,0,0.02) 10px)' : isWork || !esLaboralDia ? 'transparent' : 'rgba(0,0,0,0.03)';
                  return (
                    <div
                      key={h}
                      onClick={() => onSelectDate({ fechaInicio: new Date(new Date(d).setHours(hour)) })}
                      onMouseEnter={(ev) => { ev.currentTarget.style.background = esHoyDia ? 'rgb(var(--brand-600) / 0.16)' : 'rgb(var(--brand-600) / 0.08)'; }}
                      onMouseLeave={(ev) => { ev.currentTarget.style.background = slotBg; }}
                      style={{ height: '50px', borderBottom: '1px solid var(--color-border-light)', background: slotBg, cursor: 'pointer' }}
                    />
                  );
                })}

                {tareasPorDia[dayIdx].map((tarea) => {
                  const { top, height } = posicionesTareas.get(tarea.id) || { top: 0, height: 12 };

                  return (
                    <div
                      key={tarea.id}
                      onClick={() => onSelectEvent(tarea)}
                      title={tarea.titulo}
                      style={{
                        position: 'absolute',
                        top,
                        height,
                        left: '6px',
                        right: '6px',
                        background: tarea.color,
                        borderRadius: '7px',
                        padding: height < 18 ? '1px 4px' : '3px 6px',
                        color: '#fff',
                        fontSize: height < 18 ? '0.55rem' : '0.62rem',
                        fontWeight: 800,
                        zIndex: 4,
                        boxShadow: '0 6px 12px rgba(22,163,74,0.18)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <CheckSquare size={height < 18 ? 8 : 10} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tarea.titulo.replace(/^TAREA:\s*/i, '')}</span>
                    </div>
                  );
                })}

                {eventosConHora
                  .map(({ evento, top, height }) => {
                    const isInvited = evento.usuarioId !== currentUserId;

                    return (
                      <div
                        key={evento.id}
                        onClick={() => onSelectEvent(evento)}
                        style={{ position: 'absolute', top, height: Math.max(height, 20), left: '2px', right: '2px', background: evento.color, borderRadius: '4px', padding: '4px', color: '#fff', fontSize: '0.65rem', fontWeight: '700', zIndex: 5, boxShadow: 'var(--shadow-sm)', opacity: isInvited ? 0.9 : 1, border: isInvited ? '2px dashed rgba(255,255,255,0.5)' : 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                      >
                        {evento.tipo === 'reunion' ? <Users size={10} /> : evento.tipo === 'actividad' ? <Activity size={10} /> : evento.tipo === 'tarea' ? <CheckSquare size={10} /> : evento.esGlobal ? <Globe size={10} /> : evento.esCompartido ? <Users size={10} /> : null}
                        {evento.esOcurrencia ? <Repeat size={10} /> : null}
                        {evento.titulo}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const VistaDiaria = ({ date, eventos, diasEspeciales, configLaboral, currentUserId, isMobile, onSelectEvent, onSelectDate, onEliminar, ocultarBloquesProyecto = false }) => {
  const { t, locale } = usePreferences();
  const { inicio: hStart, fin: hEnd } = getRangoHorasVisible(configLaboral, eventos, [date]);
  const horas = getHoras(hStart, hEnd);
  const { esLaboral, diaEspecial } = getEstadoLaboral(date, configLaboral, diasEspeciales);
  const proyectosDelDia = ocultarBloquesProyecto
    ? []
    : eventos.filter((evento) => itemAgendaOcurreEnFecha(evento, date, configLaboral, diasEspeciales) && esBloqueProyecto(evento));
  const evs = eventos.filter((evento) => itemAgendaOcurreEnFecha(evento, date, configLaboral, diasEspeciales) && !esBloqueProyecto(evento));
  const evsTodoElDia = evs.filter((evento) => evento.todoElDia);
  const evsConHora = evs.filter((evento) => !evento.todoElDia);
  const tareasDelDia = evs.filter((evento) => evento.tipo === 'tarea');
  const eventosConHora = evsConHora
    .filter((evento) => evento.tipo !== 'tarea')
    .map((evento) => {
      const start = new Date(evento.fechaInicio);
      const end = evento.fechaFin ? new Date(evento.fechaFin) : new Date(start.getTime() + 3600000);
      const isStartDay = getDateKey(start) === getDateKey(date);
      const isEndDay = getDateKey(end) === getDateKey(date);
      const displayStart = isStartDay ? start.getHours() + start.getMinutes() / 60 : hStart;
      const displayEnd = isEndDay ? end.getHours() + end.getMinutes() / 60 : hEnd + 1;
      if (displayEnd <= hStart || displayStart >= hEnd + 1) return null;
      const top = (Math.max(displayStart, hStart) - hStart) * 80;
      const height = (Math.min(displayEnd, hEnd + 1) - Math.max(displayStart, hStart)) * 80;
      return { evento, top, height: Math.max(height, 40), start, end };
    })
    .filter(Boolean);
  const altoGrid = horas.length * 80;
  const rangoBase = getRangoLaboralBase(configLaboral);
  const inicioLaboral = Math.max(hStart, rangoBase.inicio);
  const finLaboral = Math.min(hEnd + 1, rangoBase.finExclusivo);
  const topLaboral = Math.max(0, (inicioLaboral - hStart) * 80);
  const bottomLaboral = Math.min(altoGrid, (finLaboral - hStart) * 80);
  const rangoTareas = bottomLaboral > topLaboral
    ? [{ start: topLaboral, end: bottomLaboral }]
    : [{ start: 0, end: altoGrid }];
  const huecosTareas = restarIntervalos(
    rangoTareas,
    eventosConHora.map(({ top, height }) => ({ start: Math.max(0, top - 8), end: Math.min(altoGrid, top + height + 8) }))
  );
  const posicionesTareas = distribuirEnHuecos(tareasDelDia, huecosTareas, altoGrid);
  const colorHeader = esLaboral ? 'var(--color-primary)' : '#ef4444';

  return (
    <div style={{ display: 'flex', height: '650px', flexDirection: isMobile ? 'column' : 'row' }}>
      <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
        <div style={{ width: isMobile ? '50px' : '80px', borderRight: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
          {horas.map((h) => (
            <div key={h} style={{ height: '80px', padding: '0.5rem', fontSize: '0.7rem', fontWeight: '800', color: 'var(--color-text-dim)', textAlign: 'right', borderBottom: '1px solid var(--color-border-light)' }}>
              {h}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative', background: proyectosDelDia.length ? 'rgb(var(--brand-600) / 0.055)' : !esLaboral ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
          {horas.map((h) => {
            const hour = parseInt(h, 10);
            const isWork = configLaboral ? hour >= parseInt(configLaboral.horaEntrada, 10) && hour < parseInt(configLaboral.horaSalida, 10) : true;
            return (
              <div
                key={h}
                onClick={() => onSelectDate({ fechaInicio: new Date(new Date(date).setHours(hour)) })}
                style={{ height: '80px', borderBottom: '1px solid var(--color-border-light)', background: isWork || !esLaboral ? 'transparent' : 'rgba(0,0,0,0.03)', cursor: 'pointer' }}
              />
            );
          })}

          {tareasDelDia.map((tarea) => {
            const { top, height } = posicionesTareas.get(tarea.id) || { top: 0, height: 18 };

            return (
              <div
                key={tarea.id}
                onClick={() => onSelectEvent(tarea)}
                title={tarea.titulo}
                style={{
                  position: 'absolute',
                  top,
                  height,
                  left: '14px',
                  right: '14px',
                  background: tarea.color,
                  borderRadius: '10px',
                  padding: height < 22 ? '2px 8px' : '6px 10px',
                  color: '#fff',
                  fontSize: height < 22 ? '0.62rem' : '0.78rem',
                  fontWeight: 800,
                  zIndex: 5,
                  boxShadow: '0 8px 16px rgba(22,163,74,0.18)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <CheckSquare size={height < 22 ? 10 : 13} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tarea.titulo.replace(/^TAREA:\s*/i, '')}</span>
              </div>
            );
          })}

          {eventosConHora.map(({ evento, top, height, start, end }) => {
            return (
              <div
                key={evento.id}
                onClick={() => onSelectEvent(evento)}
                style={{ position: 'absolute', top, height, left: '10px', right: '10px', background: evento.color, borderRadius: '12px', padding: '1rem', color: '#fff', boxShadow: 'var(--shadow-lg)', zIndex: 10, cursor: 'pointer', border: evento.usuarioId !== currentUserId ? '2px dashed rgba(255,255,255,0.4)' : 'none' }}
              >
                <div style={{ fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {evento.tipo === 'reunion' ? <Users size={14} /> : evento.tipo === 'actividad' ? <Activity size={14} /> : evento.tipo === 'tarea' ? <CheckSquare size={14} /> : evento.esGlobal ? <Globe size={14} /> : evento.esCompartido ? <Users size={14} /> : null}
                  {evento.esOcurrencia ? <Repeat size={10} /> : null}
                  {evento.titulo}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {formatHora(start, locale)} - {formatHora(end, locale)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ width: isMobile ? '100%' : '350px', background: 'var(--color-surface-2)', padding: '1.5rem', borderLeft: isMobile ? 'none' : '1px solid var(--color-border)', borderTop: isMobile ? '1px solid var(--color-border)' : 'none', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: colorHeader, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '900' }}>
            {date.getDate()}
          </div>
          <div>
            <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>{formatFechaLarga(date, locale)}</div>
            <div style={{ fontSize: '0.7rem', color: colorHeader, fontWeight: '800' }}>
              {esLaboral ? 'DIA LABORAL' : diaEspecial?.descripcion || 'DIA DE DESCANSO'}
            </div>
          </div>
        </div>

        <h3 style={{ fontWeight: '900', fontSize: '0.85rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          Agenda del día
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {evs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>No hay eventos para hoy</div>
          ) : (
            [...evsTodoElDia, ...evsConHora]
              .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
              .map((evento) => (
                <div key={evento.id} style={{ padding: '1.25rem', background: 'var(--color-surface)', borderRadius: '1.25rem', borderLeft: `5px solid ${evento.color}`, boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {evento.tipo === 'reunion' ? <Users size={14} style={{ color: 'var(--color-primary)' }} /> : evento.tipo === 'actividad' ? <Activity size={14} style={{ color: 'var(--color-primary)' }} /> : evento.tipo === 'tarea' ? <CheckSquare size={14} style={{ color: 'var(--color-primary)' }} /> : null}
                      {evento.esOcurrencia ? <Repeat size={10} /> : null}
                      {evento.titulo}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!evento.esLectura && (
                        <>
                          <button onClick={() => onSelectEvent(evento)} className="btn-icon-sm"><Edit2 size={12} /></button>
                          <button onClick={() => onEliminar(evento.id)} className="btn-icon-sm" style={{ color: 'var(--color-error)' }}><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {evento.esGlobal ? (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={12} /> EVENTO GLOBAL</div>
                  ) : evento.esCompartido ? (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> EVENTO COMPARTIDO</div>
                  ) : null}

                  {evento.usuarioId !== currentUserId && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                      {t('agendaOrganizedBy')} <b>{evento.creador?.nombre}</b>
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {evento.todoElDia
                      ? t('agendaAllDay')
                      : `${formatHora(evento.fechaInicio, locale)}${evento.fechaFin ? ` - ${formatHora(evento.fechaFin, locale)}` : ''}`}
                  </div>

                  {evento.descripcion && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: '0.75rem', lineHeight: 1.45 }}>
                      {evento.descripcion}
                    </div>
                  )}

                  {(evento.modalidad || evento.ubicacion || evento.urlReunion || evento.instruccionesAcceso) && (
                    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {evento.modalidad && (
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                          {evento.modalidad === 'virtual' ? 'REUNION VIRTUAL' : 'REUNION PRESENCIAL'}
                        </div>
                      )}
                      {evento.ubicacion && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                          Ubicacion: <b>{evento.ubicacion}</b>
                        </div>
                      )}
                      {evento.urlReunion && (
                        <div style={{ fontSize: '0.75rem' }}>
                          <a
                            href={evento.urlReunion}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'var(--color-primary)', fontWeight: '800', textDecoration: 'none' }}
                          >
                            Abrir enlace de reunion
                          </a>
                        </div>
                      )}
                      {evento.instruccionesAcceso && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                          {evento.instruccionesAcceso}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AgendaPage;
