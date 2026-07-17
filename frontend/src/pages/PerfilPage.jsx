import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Mail,
  Phone,
  Briefcase,
  FolderKanban,
  ShieldCheck,
  Building2,
  Save,
  UserRound,
  Sparkles,
  BadgeCheck,
  Bell,
  ClipboardList,
  ImagePlus,
} from 'lucide-react';
import { PageSkeleton } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { etiquetaRol } from '../utils/roles';
import { useToast } from '../context/ToastContext';
import { getPublicAssetUrl, usuariosService } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';

const formatDate = (value) => {
  if (!value) return 'Sin dato';
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const getInitials = (nombre = '') => (
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('') || 'U'
);

const AREAS_KEY = {
  VENTAS: 'areaVentas',
  ALMACEN: 'areaAlmacen',
  COMPRAS: 'areaCompras',
  ADMINISTRACION: 'areaAdministracion',
  RENTA: 'areaRenta',
  TALLER: 'areaTaller',
};

const PerfilPage = () => {
  const { t } = usePreferences();
  const { usuario, updateUsuario } = useAuth();
  const { showToast } = useToast();
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [removeFoto, setRemoveFoto] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    puesto: '',
    biografia: '',
  });

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        setCargando(true);
        const data = await usuariosService.perfil();
        const nextPerfil = data.perfil;
        setPerfil(nextPerfil);
        setForm({
          nombre: nextPerfil.nombre || '',
          email: nextPerfil.email || '',
          telefono: nextPerfil.telefono || '',
          puesto: nextPerfil.puesto || '',
          biografia: nextPerfil.biografia || '',
        });
        setPreviewFoto(getPublicAssetUrl(nextPerfil.fotoPerfilUrl));
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setCargando(false);
      }
    };

    cargarPerfil();
  }, [showToast]);

  useEffect(() => {
    if (!archivoFoto) return undefined;
    const objectUrl = URL.createObjectURL(archivoFoto);
    setPreviewFoto(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [archivoFoto]);

  const proyectosDestacados = useMemo(() => {
    if (!perfil) return [];
    const combinados = new Map();
    [...perfil.proyectosMiembro, ...perfil.proyectosCreados].forEach((proyecto) => {
      combinados.set(proyecto.id, proyecto);
    });
    return [...combinados.values()].slice(0, 8);
  }, [perfil]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setGuardando(true);
      const payload = new FormData();
      payload.append('nombre', form.nombre);
      payload.append('email', form.email);
      payload.append('telefono', form.telefono);
      payload.append('puesto', form.puesto);
      payload.append('biografia', form.biografia);
      payload.append('removeFoto', String(removeFoto));
      if (archivoFoto) {
        payload.append('fotoPerfil', archivoFoto);
      }

      const data = await usuariosService.actualizarPerfil(payload);
      setPerfil(data.perfil);
      setArchivoFoto(null);
      setRemoveFoto(false);
      setPreviewFoto(getPublicAssetUrl(data.perfil.fotoPerfilUrl));
      updateUsuario(data.perfil);
      showToast('Perfil actualizado');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <PageSkeleton cards={4} />;
  if (!perfil) {
    return (
      <div className="mx-auto max-w-3xl rounded-[32px] border border-orange-200 bg-[var(--color-surface)] p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-orange-700">
          <Sparkles size={12} />
          {t('profileNotAvailable')}
        </div>
        <h1 className="mt-4 text-2xl font-black text-[var(--color-text)]">{t('profileLoadError')}</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Intenta recargar la p&aacute;gina. Si el problema sigue, revisamos el backend para terminar de aplicar los cambios pendientes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="relative overflow-hidden rounded-[36px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgb(var(--brand-600)/0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_28%)] pointer-events-none" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border-4 border-white bg-slate-100 text-2xl font-black text-slate-500 shadow-lg shadow-slate-200/70">
                {previewFoto ? (
                  <img src={previewFoto} alt={perfil.nombre} className="h-full w-full object-cover" />
                ) : (
                  getInitials(perfil.nombre)
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-brand-300 hover:text-brand-600">
                <Camera size={16} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setArchivoFoto(file);
                    setRemoveFoto(false);
                  }}
                />
              </label>
            </div>

            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-brand-700">
                <Sparkles size={12} />
                {t('profileTitle')}
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">{perfil.nombre}</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                Administra tu información personal, tu foto de perfil y el contexto de trabajo que te acompaña dentro del panel.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {etiquetaRol(perfil.rol)}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  {t(AREAS_KEY[perfil.area] || 'areaGeneral')}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {perfil.estado === 'activo' ? t('profileActive') : t('profilePending')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-[340px]">
            {[
              { label: t('profileStatsActive'),  value: perfil.resumen?.proyectosActivos ?? 0, icon: <FolderKanban size={18} /> },
              { label: t('profileStatsTasks'),  value: perfil.resumen?.tareasAsignadas ?? 0, icon: <ClipboardList size={18} /> },
              { label: t('profileStatsCreated'),value: perfil.resumen?.tareasCreadas ?? 0, icon: <BadgeCheck size={18} /> },
              { label: t('profileStatsPending'),value: perfil.resumen?.notificacionesPendientes ?? 0, icon: <Bell size={18} /> },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  {item.icon}
                </div>
                <div className="text-2xl font-black text-slate-900">{item.value}</div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <form onSubmit={handleSubmit} className="rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm lg:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-[var(--color-text)]">{t('profilePersonalInfo')}</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('fieldName')}</span>
              <div className="relative">
                <UserRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  required
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('fieldEmail')}</span>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  required
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('fieldPhone')}</span>
              <div className="relative">
                <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.telefono}
                  onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  placeholder={t('fieldPhonePlaceholder')}
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('fieldPosition')}</span>
              <div className="relative">
                <Briefcase size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.puesto}
                  onChange={(e) => setForm((prev) => ({ ...prev, puesto: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  placeholder={t('fieldPositionPlaceholder')}
                />
              </div>
            </label>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t('fieldBio')}</span>
            <textarea
              rows={5}
              value={form.biografia}
              onChange={(e) => setForm((prev) => ({ ...prev, biografia: e.target.value }))}
              className="w-full resize-none rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              placeholder={t('fieldBioPlaceholder')}
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:border-brand-300 hover:text-brand-700">
              <ImagePlus size={16} />
              {t('profileChangePhoto')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setArchivoFoto(file);
                  setRemoveFoto(false);
                }}
              />
            </label>

            {previewFoto && (
              <button
                type="button"
                onClick={() => {
                  setArchivoFoto(null);
                  setPreviewFoto('');
                  setRemoveFoto(true);
                }}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 transition-all hover:bg-rose-100"
              >
                {t('profileRemovePhoto')}
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-400">
              Tu avatar, nombre y correo se reflejan en el layout y en el resto del panel.
            </p>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {guardando ? t('saving') : t('profileSave')}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-black text-[var(--color-text)]">{t('profileAccountData')}</h2>
            <div className="mt-5 space-y-4">
              {[
                { label: t('fieldArea'),           value: t(AREAS_KEY[perfil.area] || 'areaGeneral'), icon: <Building2 size={16} /> },
                { label: t('fieldRole'),           value: etiquetaRol(perfil.rol), icon: <ShieldCheck size={16} /> },
                { label: t('fieldRegistration'),   value: formatDate(perfil.creadoEn), icon: <BadgeCheck size={16} /> },
                { label: t('fieldGoogleCalendar'), value: perfil.googleCalendarEmail || t('fieldNotConnected'), icon: <Mail size={16} /> },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</div>
                    <div className="mt-1 text-sm font-bold text-slate-700">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-black text-[var(--color-text)]">{t('profileRelatedProjects')}</h2>
            <p className="mt-1 text-sm text-slate-500">Vista rápida de los proyectos donde participas o que has creado.</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {proyectosDestacados.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-400">
                  {t('profileNoProjects')}
                </div>
              )}

              {proyectosDestacados.map((proyecto) => (
                <div key={proyecto.id} className="min-w-[180px] flex-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-sm font-black text-slate-800">{proyecto.nombre}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {t(AREAS_KEY[proyecto.area] || 'areaGeneral')}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {proyecto.estado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;
