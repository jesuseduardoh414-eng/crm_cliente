const prisma = require('../lib/prisma');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPE = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

const DAY_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const isGoogleCalendarConfigured = () => (
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
);

const toGoogleDateTime = (date) => ({
  dateTime: new Date(date).toISOString(),
  timeZone: 'America/Mexico_City',
});

const toGoogleAllDayRange = (inicio, fin) => {
  const start = new Date(inicio);
  const rawEnd = fin ? new Date(fin) : new Date(inicio);
  const exclusiveEnd = new Date(Date.UTC(
    rawEnd.getUTCFullYear(),
    rawEnd.getUTCMonth(),
    rawEnd.getUTCDate() + 1
  ));

  return {
    start: { date: start.toISOString().split('T')[0] },
    end: { date: exclusiveEnd.toISOString().split('T')[0] },
  };
};

const buildRecurrenceRule = (evento) => {
  if (!evento.esRecurrente || !evento.patronRecurrencia) return [];

  try {
    const patron = typeof evento.patronRecurrencia === 'string'
      ? JSON.parse(evento.patronRecurrencia)
      : evento.patronRecurrencia;

    const dias = Array.isArray(patron?.dias)
      ? patron.dias.map((dia) => DAY_CODE[dia]).filter(Boolean)
      : [];

    if (dias.length === 0) return [];

    const parts = ['RRULE:FREQ=WEEKLY', `BYDAY=${dias.join(',')}`];
    if (evento.fechaFinRecurr) {
      const untilDate = new Date(evento.fechaFinRecurr);
      untilDate.setUTCHours(23, 59, 59, 999);
      const until = untilDate
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
      parts.push(`UNTIL=${until}`);
    }

    return [parts.join(';')];
  } catch (error) {
    console.warn('[google-calendar] No se pudo construir la recurrencia:', error.message);
    return [];
  }
};

const buildGoogleEventPayload = (evento) => {
  const attendees = (evento.invitados || [])
    .map((invitado) => invitado?.usuario?.email)
    .filter((email) => !!email && email !== evento.usuario?.email)
    .map((email) => ({ email }));

  const payload = {
    summary: evento.titulo,
    description: [
      evento.descripcion,
      evento.instruccionesAcceso ? `Instrucciones: ${evento.instruccionesAcceso}` : null,
      evento.proyecto?.nombre ? `Proyecto: ${evento.proyecto.nombre}` : null,
      'Sincronizado desde FEMIC Maquinaria',
    ].filter(Boolean).join('\n\n'),
    location: evento.modalidad === 'presencial' ? (evento.ubicacion || undefined) : undefined,
    attendees: attendees.length > 0 ? attendees : undefined,
    reminders: evento.alertaMinutos
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: evento.alertaMinutos }] }
      : { useDefault: true },
    colorId: undefined,
    extendedProperties: {
      private: {
        crmEventId: evento.id,
        crmTipo: evento.tipo,
      },
    },
  };

  if (evento.urlReunion) {
    payload.description = `${payload.description}\n\nEnlace: ${evento.urlReunion}`;
  }

  if (evento.todoElDia) {
    Object.assign(payload, toGoogleAllDayRange(evento.fechaInicio, evento.fechaFin));
  } else {
    payload.start = toGoogleDateTime(evento.fechaInicio);
    payload.end = toGoogleDateTime(evento.fechaFin || evento.fechaInicio);
  }

  const recurrence = buildRecurrenceRule(evento);
  if (recurrence.length > 0) payload.recurrence = recurrence;

  return payload;
};

const postForm = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Error de Google');
  }
  return data;
};

const saveGoogleTokens = async (usuarioId, tokenData) => {
  const accessToken = tokenData.access_token || null;
  const refreshToken = tokenData.refresh_token || null;
  const expiresIn = Number(tokenData.expires_in || 0);
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + Math.max(expiresIn - 60, 0) * 1000) : null;
  const profile = accessToken
    ? await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((res) => res.ok ? res.json() : null).catch(() => null)
    : null;

  return prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      googleCalendarEmail: profile?.email || undefined,
      googleAccessToken: accessToken,
      googleRefreshToken: refreshToken || undefined,
      googleTokenExpiresAt: expiresAt,
    },
    select: {
      googleCalendarEmail: true,
      googleTokenExpiresAt: true,
      googleRefreshToken: true,
    },
  });
};

const exchangeCodeForTokens = async (code) => postForm(GOOGLE_TOKEN_URL, {
  code,
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: 'postmessage',
  grant_type: 'authorization_code',
});

const refreshAccessToken = async (usuario) => {
  if (!usuario.googleRefreshToken) {
    throw new Error('La cuenta de Google no tiene refresh token');
  }

  const tokenData = await postForm(GOOGLE_TOKEN_URL, {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: usuario.googleRefreshToken,
    grant_type: 'refresh_token',
  });

  const updated = await saveGoogleTokens(usuario.id, {
    ...tokenData,
    refresh_token: usuario.googleRefreshToken,
  });

  return {
    accessToken: tokenData.access_token,
    email: updated.googleCalendarEmail || usuario.googleCalendarEmail,
  };
};

const getValidAccessToken = async (usuarioId) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
      googleCalendarEmail: true,
    },
  });

  if (!usuario?.googleAccessToken && !usuario?.googleRefreshToken) return null;

  const stillValid = usuario.googleAccessToken
    && usuario.googleTokenExpiresAt
    && usuario.googleTokenExpiresAt > new Date();

  if (stillValid) {
    return {
      accessToken: usuario.googleAccessToken,
      email: usuario.googleCalendarEmail,
    };
  }

  return refreshAccessToken(usuario);
};

const googleCalendarRequest = async (usuarioId, path, options = {}) => {
  const token = await getValidAccessToken(usuarioId);
  if (!token?.accessToken) return null;

  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    const refreshed = await getValidAccessToken(usuarioId);
    if (!refreshed?.accessToken) return null;

    const retry = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${refreshed.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return retry;
  }

  return response;
};

const getConnectionStatus = async (usuarioId) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      googleCalendarEmail: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
    },
  });

  return {
    configured: isGoogleCalendarConfigured(),
    connected: !!(usuario?.googleRefreshToken || usuario?.googleAccessToken),
    email: usuario?.googleCalendarEmail || null,
    expiresAt: usuario?.googleTokenExpiresAt || null,
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    scope: GOOGLE_SCOPE,
  };
};

const connectGoogleCalendar = async ({ usuarioId, code }) => {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar no esta configurado en el servidor');
  }

  const tokenData = await exchangeCodeForTokens(code);
  const usuario = await saveGoogleTokens(usuarioId, tokenData);

  return {
    connected: true,
    email: usuario.googleCalendarEmail || null,
    expiresAt: usuario.googleTokenExpiresAt || null,
  };
};

const disconnectGoogleCalendar = async (usuarioId) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  });

  const token = usuario?.googleRefreshToken || usuario?.googleAccessToken;
  if (token) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (error) {
      console.warn('[google-calendar] No se pudo revocar el token:', error.message);
    }
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      googleCalendarEmail: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
    },
  });
};

const getEventoForSync = async (eventoId) => prisma.evento.findUnique({
  where: { id: eventoId },
  include: {
    usuario: { select: { id: true, email: true, nombre: true } },
    proyecto: { select: { id: true, nombre: true } },
    invitados: {
      include: {
        usuario: { select: { id: true, email: true, nombre: true } },
      },
    },
  },
});

const syncEventoToGoogle = async (eventoId) => {
  const evento = await getEventoForSync(eventoId);
  if (!evento) return null;

  const connection = await getValidAccessToken(evento.usuarioId);
  if (!connection?.accessToken) return null;

  const payload = buildGoogleEventPayload(evento);
  const method = evento.googleCalendarEventId ? 'PUT' : 'POST';
  const path = evento.googleCalendarEventId
    ? `/calendars/primary/events/${encodeURIComponent(evento.googleCalendarEventId)}?sendUpdates=none`
    : '/calendars/primary/events?sendUpdates=none';

  const response = await googleCalendarRequest(evento.usuarioId, path, {
    method,
    body: JSON.stringify(payload),
  });

  if (!response) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || 'No se pudo sincronizar con Google Calendar');
  }

  if (data.id && data.id !== evento.googleCalendarEventId) {
    await prisma.evento.update({
      where: { id: evento.id },
      data: { googleCalendarEventId: data.id },
    });
  }

  return data;
};

const deleteEventoFromGoogle = async (evento) => {
  if (!evento?.googleCalendarEventId || !evento?.usuarioId) return;

  const response = await googleCalendarRequest(
    evento.usuarioId,
    `/calendars/primary/events/${encodeURIComponent(evento.googleCalendarEventId)}?sendUpdates=none`,
    { method: 'DELETE' }
  );

  if (!response || response.status === 404) return;
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'No se pudo eliminar el evento en Google Calendar');
  }
};

module.exports = {
  GOOGLE_SCOPE,
  isGoogleCalendarConfigured,
  getConnectionStatus,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  syncEventoToGoogle,
  deleteEventoFromGoogle,
};
