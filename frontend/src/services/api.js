// Servicio de comunicación con el backend
// Centraliza la URL base y el manejo del JWT en cada petición

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PUBLIC_BASE_URL = API_URL.startsWith('http') ? API_URL.replace(/\/api\/?$/, '') : '';

// ── Helpers internos ──────────────────────────────────────────────────────

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('crm_token');
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (res) => {
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }
  if (!res.ok) throw new Error(data.error || 'Error en la petición');
  return data;
};

const emitScheduleSync = (detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('crm:schedule-changed', { detail }));
};

export const getPublicAssetUrl = (value) => {
  if (!value) return '';
  if (/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `${PUBLIC_BASE_URL}${value}`;
};

// ── Auth ──────────────────────────────────────────────────────────────────

export const authService = {
  register: async (datos) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },

  login: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  me: async () => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
    return handleResponse(res);
  },

  forgotPassword: async (email) => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ email }),
    });
    return handleResponse(res);
  },

  resetPassword: async (token, password) => {
    const res = await fetch(`${API_URL}/auth/reset-password/${token}`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ password }),
    });
    return handleResponse(res);
  },

  verifyAccount: async (token) => {
    const res = await fetch(`${API_URL}/auth/verify/${token}`);
    return handleResponse(res);
  },
  
  // Invitaciones
  verificarInvitacion: async (token) => {
    const res = await fetch(`${API_URL}/auth/invitacion/${token}`);
    return handleResponse(res);
  },
  
  aceptarInvitacion: async (token, datos) => {
    const res = await fetch(`${API_URL}/auth/invitacion/${token}/aceptar`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
};

// ── Proyectos ─────────────────────────────────────────────────────────────

export const proyectosService = {
  listar: async () => {
    const res = await fetch(`${API_URL}/proyectos`, { headers: getHeaders() });
    return handleResponse(res);
  },

  equipoDeProyecto: async (id) => {
    const res = await fetch(`${API_URL}/proyectos/${id}/equipo`, { headers: getHeaders() });
    return handleResponse(res);
  },

  crear: async (datos) => {
    const isMultipart = datos instanceof FormData;
    const res = await fetch(`${API_URL}/proyectos`, {
      method: 'POST',
      headers: getHeaders(isMultipart),
      body: isMultipart ? datos : JSON.stringify(datos),
    });
    return handleResponse(res);
  },

  editar: async (id, datos) => {
    const isMultipart = datos instanceof FormData;
    const res = await fetch(`${API_URL}/proyectos/${id}`, {
      method: 'PUT',
      headers: getHeaders(isMultipart),
      body: isMultipart ? datos : JSON.stringify(datos),
    });
    return handleResponse(res);
  },

  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/proyectos/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },

  listarPlantillas: async () => {
    const res = await fetch(`${API_URL}/proyectos/plantillas`, { headers: getHeaders() });
    return handleResponse(res);
  },

  guardarComoPlantilla: async (proyectoId, datos) => {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/plantilla`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },

  // ── Maquinaria de la obra, con su operador ──────────────────────────────
  listarMaquinaria: async (proyectoId) => {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/maquinaria`, { headers: getHeaders() });
    return handleResponse(res);
  },

  asignarMaquina: async (proyectoId, datos) => {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/maquinaria`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },

  actualizarAsignacion: async (asignacionId, datos) => {
    const res = await fetch(`${API_URL}/proyectos/maquinaria/${asignacionId}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },

  retirarMaquina: async (asignacionId) => {
    const res = await fetch(`${API_URL}/proyectos/maquinaria/${asignacionId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },

  operadoresAsignables: async () => {
    const res = await fetch(`${API_URL}/proyectos/operadores-asignables`, { headers: getHeaders() });
    return handleResponse(res);
  },
};

// ── Tareas ────────────────────────────────────────────────────────────────

export const tareasService = {
  // Listar tareas de un proyecto (también devuelve info del proyecto)
  listar: async (proyectoId) => {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/tareas`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  crear: async (proyectoId, datos) => {
    const isMultipart = datos instanceof FormData;
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/tareas`, {
      method: 'POST',
      headers: getHeaders(isMultipart),
      body: isMultipart ? datos : JSON.stringify(datos),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'tarea', action: 'crear', proyectoId });
    return data;
  },

  editar: async (id, datos) => {
    const res = await fetch(`${API_URL}/tareas/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'tarea', action: 'editar', id });
    return data;
  },

  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/tareas/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'tarea', action: 'eliminar', id });
    return data;
  },

  // Cambio rápido de estado inline
  actualizarEstado: async (id, estado) => {
    const res = await fetch(`${API_URL}/tareas/${id}/estado`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ estado }),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'tarea', action: 'estado', id, estado });
    return data;
  },

  // ── Importación masiva ──────────────────────────────────────────────────
  importar: async (proyectoId, archivo, modoAsignacion = 'archivo', asignadoId = null) => {
    const fd = new FormData();
    fd.append('archivo', archivo);
    fd.append('modoAsignacion', modoAsignacion);
    if (asignadoId) fd.append('asignadoId', asignadoId);
    const token = localStorage.getItem('crm_token');
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/tareas/importar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return handleResponse(res);
  },

  previewImportar: async (proyectoId, archivo, modoAsignacion = 'archivo', asignadoId = null) => {
    const fd = new FormData();
    fd.append('archivo', archivo);
    fd.append('modoAsignacion', modoAsignacion);
    if (asignadoId) fd.append('asignadoId', asignadoId);
    const token = localStorage.getItem('crm_token');
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/tareas/importar/preview`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return handleResponse(res);
  },

  confirmarImportacion: async (proyectoId, filas, modoAsignacion = 'archivo', asignadoId = null) => {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/tareas/importar/confirmar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        filas,
        modoAsignacion,
        asignadoId,
      }),
    });
    return handleResponse(res);
  },

  descargarPlantilla: (tipo) => {
    const token = localStorage.getItem('crm_token');
    const url   = `${API_URL}/tareas/plantilla/${tipo}`;
    const a = document.createElement('a');
    a.href = url + (token ? `?token=${token}` : '');
    a.download = `plantilla_tareas.${tipo === 'json' ? 'json' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  exportarProyecto: (proyectoId, tipo = 'json') => {
    const token = localStorage.getItem('crm_token');
    const url = `${API_URL}/proyectos/${proyectoId}/tareas/exportar/${tipo}`;
    const a = document.createElement('a');
    a.href = url + (token ? `?token=${token}` : '');
    a.download = `proyecto_${proyectoId}_tareas.${tipo === 'excel' ? 'xlsx' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};

// ── Usuarios ──────────────────────────────────────────────────────────────

export const usuariosService = {
  listar: async () => {
    const res = await fetch(`${API_URL}/usuarios`, { headers: getHeaders() });
    return handleResponse(res);
  },
  listarParaProyectos: async () => {
    const res = await fetch(`${API_URL}/usuarios/catalogo/proyectos`, { headers: getHeaders() });
    return handleResponse(res);
  },
  perfil: async () => {
    const res = await fetch(`${API_URL}/usuarios/perfil`, { headers: getHeaders() });
    return handleResponse(res);
  },
  actualizarPerfil: async (datos) => {
    const res = await fetch(`${API_URL}/usuarios/perfil`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: datos,
    });
    return handleResponse(res);
  },
  actividad: async (id) => {
    const res = await fetch(`${API_URL}/usuarios/${id}/actividad?t=${Date.now()}`, {
      headers: { ...getHeaders(), 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });
    return handleResponse(res);
  },
  crear: async (datos) => {
    const res = await fetch(`${API_URL}/usuarios`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  editar: async (id, datos) => {
    const res = await fetch(`${API_URL}/usuarios/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/usuarios/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
  toggleEstado: async (id, estado) => {
    const res = await fetch(`${API_URL}/usuarios/${id}/estado`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify({ estado }),
    });
    return handleResponse(res);
  },
  
  // Invitaciones (Solo Admin)
  invitar: async (datos) => {
    const res = await fetch(`${API_URL}/auth/invitar`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  reenviarInvitacion: async (email) => {
    const res = await fetch(`${API_URL}/auth/invitar/reenviar`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ email }),
    });
    return handleResponse(res);
  },
  listarInvitaciones: async () => {
    const res = await fetch(`${API_URL}/auth/invitaciones`, { headers: getHeaders() });
    return handleResponse(res);
  },
  eliminarInvitacion: async (id) => {
    const res = await fetch(`${API_URL}/auth/invitaciones/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
};

// ── Notificaciones ────────────────────────────────────────────────────────
export const notificacionesService = {
  listar: async () => {
    const res = await fetch(`${API_URL}/notificaciones`, { headers: getHeaders() });
    return handleResponse(res);
  },
  marcarLeida: async (id) => {
    const res = await fetch(`${API_URL}/notificaciones/${id}/leida`, {
      method: 'PUT', headers: getHeaders(),
    });
    return handleResponse(res);
  },
  marcarTodasLeidas: async () => {
    const res = await fetch(`${API_URL}/notificaciones/todas/leidas`, {
      method: 'PUT', headers: getHeaders(),
    });
    return handleResponse(res);
  },
  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/notificaciones/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  }
};

// ── Comentarios ───────────────────────────────────────────────────────────
export const comentariosService = {
  listar: async (parentId, type = 'tareas') => {
    const res = await fetch(`${API_URL}/${type}/${parentId}/comentarios`, { headers: getHeaders() });
    return handleResponse(res);
  },
  crear: async (parentId, contenido, type = 'tareas') => {
    const res = await fetch(`${API_URL}/${type}/${parentId}/comentarios`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ contenido }),
    });
    return handleResponse(res);
  },
  eliminar: async (comentarioId) => {
    const res = await fetch(`${API_URL}/tareas/comentarios/${comentarioId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
};

// ── Historial (Logs) ───────────────────────────────────────────────────────
export const logsService = {
  listarPorProyecto: async (proyectoId) => {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/logs`, { headers: getHeaders() });
    return handleResponse(res);
  },
};

// ── Adjuntos ──────────────────────────────────────────────────────────────
export const adjuntosService = {
  listar: async (parentId, type = 'tareas') => {
    const res = await fetch(`${API_URL}/${type}/${parentId}/adjuntos`, { headers: getHeaders() });
    return handleResponse(res);
  },
  subir: async (parentId, payload, type = 'tareas') => {
    const formData = payload instanceof FormData
      ? payload
      : (() => {
          const fd = new FormData();
          const files = Array.isArray(payload) ? payload : Array.from(payload || []);
          files.forEach((file) => fd.append('archivos', file));
          return fd;
        })();
    const res = await fetch(`${API_URL}/${type}/${parentId}/adjuntos`, {
      method: 'POST',
      headers: getHeaders(true), // Multipart
      body: formData
    });
    return handleResponse(res);
  },
  eliminar: async (adjuntoId) => {
    const res = await fetch(`${API_URL}/tareas/adjuntos/${adjuntoId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },
  getPreviewUrl: (filename) => {
    // Los adjuntos nuevos guardan la URL absoluta de Vercel Blob; los antiguos, solo el nombre.
    if (/^https?:\/\//i.test(filename)) return filename;
    return `${API_URL}/tareas/adjuntos/ver/${filename}?token=${localStorage.getItem('crm_token')}`;
  },
  descargar: (filename) => {
    // Abrir en nueva pestaña para descargar
    if (/^https?:\/\//i.test(filename)) {
      window.open(filename, '_blank');
      return;
    }
    window.open(`${API_URL}/tareas/adjuntos/descargar/${filename}?token=${localStorage.getItem('crm_token')}`, '_blank');
  }
};

// ── Estadísticas ──────────────────────────────────────────────────────────
// ── Maquinaria en renta ───────────────────────────────────────────────────
const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const maquinasService = {
  listar: async (filtros = {}) => {
    const res = await fetch(`${API_URL}/maquinas${qs(filtros)}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  obtener: async (id) => {
    const res = await fetch(`${API_URL}/maquinas/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  tipos: async () => {
    const res = await fetch(`${API_URL}/maquinas/tipos`, { headers: getHeaders() });
    return handleResponse(res);
  },
  crear: async (datos) => {
    const res = await fetch(`${API_URL}/maquinas`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  editar: async (id, datos) => {
    const res = await fetch(`${API_URL}/maquinas/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  cambiarDisponibilidad: async (id, disponible) => {
    const res = await fetch(`${API_URL}/maquinas/${id}/disponibilidad`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ disponible }),
    });
    return handleResponse(res);
  },
  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/maquinas/${id}`, { method: 'DELETE', headers: getHeaders() });
    return handleResponse(res);
  },
  // Galeria
  listarImagenes: async (id) => {
    const res = await fetch(`${API_URL}/maquinas/${id}/imagenes`, { headers: getHeaders() });
    return handleResponse(res);
  },
  subirImagenes: async (id, files) => {
    const fd = new FormData();
    Array.from(files || []).forEach((f) => fd.append('imagenes', f));
    const res = await fetch(`${API_URL}/maquinas/${id}/imagenes`, {
      method: 'POST', headers: getHeaders(true), body: fd,
    });
    return handleResponse(res);
  },
  eliminarImagen: async (imagenId) => {
    const res = await fetch(`${API_URL}/maquinas/imagenes/${imagenId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
};

// ── Operadores ────────────────────────────────────────────────────────────
export const operadoresService = {
  listar: async (filtros = {}) => {
    const res = await fetch(`${API_URL}/operadores${qs(filtros)}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  miPerfil: async () => {
    const res = await fetch(`${API_URL}/operadores/mi-perfil`, { headers: getHeaders() });
    return handleResponse(res);
  },
  candidatos: async () => {
    const res = await fetch(`${API_URL}/operadores/candidatos`, { headers: getHeaders() });
    return handleResponse(res);
  },
  crear: async (datos) => {
    const res = await fetch(`${API_URL}/operadores`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  editar: async (id, datos) => {
    const res = await fetch(`${API_URL}/operadores/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  cambiarDisponibilidad: async (id, disponible) => {
    const res = await fetch(`${API_URL}/operadores/${id}/disponibilidad`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ disponible }),
    });
    return handleResponse(res);
  },
  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/operadores/${id}`, { method: 'DELETE', headers: getHeaders() });
    return handleResponse(res);
  },
};

// ── Panel de noticias ─────────────────────────────────────────────────────
export const publicacionesService = {
  listar: async (filtros = {}) => {
    const res = await fetch(`${API_URL}/publicaciones${qs(filtros)}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  obtener: async (id) => {
    const res = await fetch(`${API_URL}/publicaciones/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },
  crear: async (datos) => {
    const res = await fetch(`${API_URL}/publicaciones`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  editar: async (id, datos) => {
    const res = await fetch(`${API_URL}/publicaciones/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    return handleResponse(res);
  },
  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/publicaciones/${id}`, { method: 'DELETE', headers: getHeaders() });
    return handleResponse(res);
  },
  subirImagenes: async (id, files) => {
    const fd = new FormData();
    Array.from(files || []).forEach((f) => fd.append('imagenes', f));
    const res = await fetch(`${API_URL}/publicaciones/${id}/imagenes`, {
      method: 'POST', headers: getHeaders(true), body: fd,
    });
    return handleResponse(res);
  },
  eliminarImagen: async (imagenId) => {
    const res = await fetch(`${API_URL}/publicaciones/imagenes/${imagenId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
};

export const statsService = {
  getAdminStats: async () => {
    const res = await fetch(`${API_URL}/stats/admin?t=${Date.now()}`, {
      headers: { ...getHeaders(), 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });
    return handleResponse(res);
  },
  getMemberStats: async () => {
    const res = await fetch(`${API_URL}/stats/member?t=${Date.now()}`, {
      headers: { ...getHeaders(), 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });
    return handleResponse(res);
  }
};

// ── Agenda Personal ────────────────────────────────────────────────────────
export const agendaService = {
  listar: async (fechaInicio, fechaFin) => {
    let url = `${API_URL}/agenda`;
    if (fechaInicio && fechaFin) {
      url += `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },
  crear: async (datos) => {
    const res = await fetch(`${API_URL}/agenda`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(datos),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'agenda', action: 'crear' });
    return data;
  },
  editar: async (id, datos) => {
    const res = await fetch(`${API_URL}/agenda/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(datos),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'agenda', action: 'editar', id });
    return data;
  },
  eliminar: async (id) => {
    const res = await fetch(`${API_URL}/agenda/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    const data = await handleResponse(res);
    emitScheduleSync({ entity: 'agenda', action: 'eliminar', id });
    return data;
  },
  recordatorios: async () => {
    const res = await fetch(`${API_URL}/agenda/recordatorios`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Phase 8.1 - Compartidos e Invitaciones
  invitacionesPendientes: async () => {
    const res = await fetch(`${API_URL}/agenda/invitaciones/pendientes`, { headers: getHeaders() });
    return handleResponse(res);
  },
  responderInvitacion: async (id, estado) => {
    const res = await fetch(`${API_URL}/agenda/${id}/responder`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ estado }),
    });
    return handleResponse(res);
  },
  consultarDisponibilidad: async ({ usuarios_ids, inicio, fin, excluir_id, excluir_proyecto_id }) => {
    const params = new URLSearchParams({ usuarios_ids, inicio });
    if (fin) params.append('fin', fin);
    if (excluir_id) params.append('excluir_id', excluir_id);
    if (excluir_proyecto_id) params.append('excluir_proyecto_id', excluir_proyecto_id);
    const res = await fetch(`${API_URL}/agenda/disponibilidad?${params}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Phase 8.1 - Configuración Laboral
  getConfigLaboral: async () => {
    const res = await fetch(`${API_URL}/agenda/config-laboral`, { headers: getHeaders() });
    return handleResponse(res);
  },
  updateConfigLaboral: async (payload) => {
    const res = await fetch(`${API_URL}/agenda/config-laboral`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
  getGoogleCalendarStatus: async () => {
    const res = await fetch(`${API_URL}/agenda/google-calendar/status`, { headers: getHeaders() });
    return handleResponse(res);
  },
  connectGoogleCalendar: async (code) => {
    const res = await fetch(`${API_URL}/agenda/google-calendar/connect`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ code }),
    });
    return handleResponse(res);
  },
  disconnectGoogleCalendar: async () => {
    const res = await fetch(`${API_URL}/agenda/google-calendar/connect`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Phase 8.1 - Días Especiales
  listarDiasEspeciales: async (mes, anio) => {
    let url = `${API_URL}/agenda/dias-especiales`;
    if (mes && anio) url += `?mes=${mes}&anio=${anio}`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },
  crearDiaEspecial: async (payload) => {
    const res = await fetch(`${API_URL}/agenda/dias-especiales`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
  eliminarDiaEspecial: async (id) => {
    const res = await fetch(`${API_URL}/agenda/dias-especiales/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
