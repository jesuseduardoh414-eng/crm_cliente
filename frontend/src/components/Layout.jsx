import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import NotificationCenter from './NotificationCenter';
import { BRAND_NAME, BRAND_SHORT } from '../config/brand';
import { agendaService, getPublicAssetUrl } from '../services/api';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Forklift,
  HardHat,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  SunMedium,
  Users,
} from 'lucide-react';

const IconDashboard = () => <LayoutDashboard size={20} strokeWidth={2.5} />;
const IconProyectos = () => <FolderKanban size={20} strokeWidth={2.5} />;
const IconEquipo = () => <Users size={20} strokeWidth={2.5} />;
const IconGestion = () => <ShieldCheck size={20} strokeWidth={2.5} />;
const IconLogout = () => <LogOut size={18} strokeWidth={2.5} />;
const IconMenu = () => <Menu size={24} strokeWidth={2.5} />;
const IconAgenda = () => <Calendar size={20} strokeWidth={2.5} />;
const IconMaquinaria = () => <Forklift size={20} strokeWidth={2.5} />;
const IconOperadores = () => <HardHat size={20} strokeWidth={2.5} />;
const IconNoticias = () => <Megaphone size={20} strokeWidth={2.5} />;

const getInitials = (nombre = '') => (
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('') || 'U'
);

const navLinks = [
  { to: '/dashboard', labelKey: 'home', Icon: IconDashboard },
  { to: '/noticias', labelKey: 'newsPanel', Icon: IconNoticias },
  { to: '/maquinaria', labelKey: 'machinery', Icon: IconMaquinaria },
  { to: '/operadores', labelKey: 'operators', Icon: IconOperadores },
  { to: '/proyectos', labelKey: 'projects', Icon: IconProyectos },
  { to: '/agenda', labelKey: 'agenda', Icon: IconAgenda },
  { to: '/equipo', labelKey: 'community', Icon: IconEquipo },
];

const Layout = ({ children }) => {
  const { usuario, logout } = useAuth();
  const { theme, setTheme, language, setLanguage, t } = usePreferences();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('crm_sidebar_collapsed') === 'true');
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [, setRecordatoriosCount] = useState(0);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!usuario) return;

    const checarAgenda = async () => {
      try {
        const [{ recordatorios }, { pendientes }] = await Promise.all([
          agendaService.recordatorios(),
          agendaService.invitacionesPendientes(),
        ]);

        setRecordatoriosCount(recordatorios.length + pendientes.length);

        const yaNotificados = JSON.parse(localStorage.getItem('crm_recordatorios_vistos') || '[]');
        const ahora = new Date();

        recordatorios.forEach((recordatorio) => {
          if (!yaNotificados.includes(recordatorio.id)) {
            const min = Math.round((new Date(recordatorio.fechaInicio) - ahora) / 60000);
            const msg = `Recordatorio: ${recordatorio.titulo} en ${min} minutos`;
            showToast(msg, 'info');

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('CRM - Recordatorio', { body: msg, icon: '/favicon.svg' });
            }

            yaNotificados.push(recordatorio.id);
          }
        });

        localStorage.setItem('crm_recordatorios_vistos', JSON.stringify(yaNotificados));
      } catch (error) {
        console.error('Error al checar agenda:', error);
      }
    };

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    checarAgenda();
    const interval = setInterval(checarAgenda, 60000);
    return () => clearInterval(interval);
  }, [usuario, showToast]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('crm_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const toggleSidebar = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setCollapsed((prev) => !prev);
      });
      return;
    }

    setCollapsed((prev) => !prev);
  };

  const handleLogout = () => {
    logout();
    showToast('Sesion cerrada', 'info');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)] relative overflow-hidden">
      <aside
        className="
          fixed lg:sticky top-0 h-screen z-[100] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          bg-[var(--color-sidebar)] flex flex-col
        "
        style={{
          left: isDesktop ? 0 : (open ? 0 : 'calc(-1 * min(84vw, 320px))'),
          width: isDesktop
            ? (collapsed ? '92px' : 'clamp(240px, 18vw, 280px)')
            : 'min(84vw, 320px)',
          minWidth: isDesktop
            ? (collapsed ? '92px' : 'clamp(240px, 18vw, 280px)')
            : 'min(84vw, 320px)',
          maxWidth: isDesktop
            ? (collapsed ? '92px' : '280px')
            : '320px',
        }}
      >
        <div className={`relative flex w-full flex-col items-center ${collapsed ? 'gap-5 px-3 pt-6 pb-6' : 'gap-4 px-4 pt-12 pb-6'}`}>
          {/* Wordmark. El ancho del sidebar es fijo (240-280px) y el nombre es
              variable, asi que la barra no se encoge y el texto envuelve. */}
          <div
            className="flex w-full min-w-0 items-center justify-center gap-2"
            style={{ viewTransitionName: 'sidebar-logo' }}
          >
            <span
              aria-hidden="true"
              className={`shrink-0 rounded bg-accent-400 ${collapsed ? 'h-7 w-1' : 'h-6 w-1.5'}`}
            />
            <span
              className={`min-w-0 break-words font-black uppercase leading-tight tracking-tight text-white ${collapsed ? 'text-xl' : 'text-xl lg:text-2xl'}`}
            >
              {collapsed ? BRAND_SHORT : BRAND_NAME}
            </span>
          </div>

          {!collapsed && (
            <div className="text-[10px] lg:text-xs text-white/40 font-black uppercase tracking-[0.15em] text-center whitespace-nowrap">
              {t('internalPanel')}
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            className={`
              hidden lg:flex items-center ${collapsed ? 'justify-center w-full px-5' : 'gap-4 w-full px-5'}
              py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
              text-white/50 hover:text-white hover:bg-white/5
            `}
            title={collapsed ? 'Expandir menu' : undefined}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'}
          >
            <span className="shrink-0 flex items-center justify-center">
              {collapsed ? <ChevronRight size={20} strokeWidth={2.5} /> : <ChevronLeft size={20} strokeWidth={2.5} />}
            </span>
            {!collapsed && <span className="flex-1 min-w-0 truncate text-left">{t('collapse')}</span>}
          </button>
        </div>

        <nav className={`flex-1 flex flex-col gap-1 overflow-y-auto ${collapsed ? 'px-3' : 'px-4'}`}>
          {!collapsed && (
            <div className="text-[10px] font-black text-white/30 px-3 py-4 uppercase tracking-widest whitespace-nowrap">
              {t('mainMenu')}
            </div>
          )}

          {navLinks.map(({ to, labelKey, Icon }) => {
            const label = t(labelKey);
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                title={collapsed ? label : undefined}
                className={({ isActive }) => `
                  flex items-center ${collapsed ? 'justify-center' : 'gap-4'} px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                  ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}
                `}
              >
                <span className="shrink-0 flex items-center justify-center"><Icon /></span>
                {!collapsed && <span className="flex-1 min-w-0 truncate">{label}</span>}
              </NavLink>
            );
          })}

          {usuario?.rol === 'ADMIN' && (
            <>
              {!collapsed && (
                <div className="text-[10px] font-black text-white/30 px-3 py-4 mt-4 uppercase tracking-widest whitespace-nowrap">
                  {t('administration')}
                </div>
              )}

              <NavLink
                to="/usuarios"
                onClick={() => setOpen(false)}
                title={collapsed ? t('users') : undefined}
                className={({ isActive }) => `
                  flex items-center ${collapsed ? 'justify-center' : 'gap-4'} px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                  ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}
                `}
              >
                <span className="shrink-0 flex items-center justify-center"><IconGestion /></span>
                {!collapsed && <span className="min-w-0 truncate">{t('users')}</span>}
              </NavLink>
            </>
          )}
        </nav>

        <div className={`border-t border-white/5 ${collapsed ? 'p-3' : 'p-6'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center mb-3' : 'gap-3 mb-5'}`}>
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-black text-white border-2 border-white/10 transition-all hover:scale-105"
              title={collapsed ? usuario?.nombre : undefined}
            >
              {usuario?.fotoPerfilUrl ? (
                <img src={getPublicAssetUrl(usuario.fotoPerfilUrl)} alt={usuario?.nombre} className="h-full w-full object-cover" />
              ) : (
                getInitials(usuario?.nombre)
              )}
            </button>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{usuario?.nombre}</div>
                <div className="text-[11px] text-white/40 font-medium truncate">
                  {usuario?.email?.split('@')[0]}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={collapsed ? t('logout') : undefined}
            className={`w-full p-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-all flex items-center justify-center whitespace-nowrap ${collapsed ? '' : 'gap-2'}`}
          >
            <span className="shrink-0 flex items-center justify-center"><IconLogout /></span>
            {!collapsed && <span className="truncate">{t('logout')}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-screen bg-[var(--color-bg-base)] overflow-hidden">
        <header className="h-16 lg:h-[70px] bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-4 lg:px-10 gap-4 lg:gap-8 sticky top-0 z-[90]">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 -ml-2 text-[var(--color-text)] hover:bg-[var(--color-surface-3)] rounded-xl transition-colors"
            aria-label="Abrir menu"
          >
            <IconMenu />
          </button>

          <div className="relative flex-1 max-w-xl group">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-50 transition-opacity text-[var(--color-text-dim)]">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 lg:py-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] text-[var(--color-text)] text-xs lg:text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
            <span className="hidden lg:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 rounded shadow-sm">
              Ctrl+K
            </span>
          </div>

          <div className="flex items-center gap-2 lg:gap-5 ml-auto">
            <div className="hidden md:flex items-center gap-2">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label={t('language')}
                className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-text-dim)] outline-none transition-all hover:border-[var(--color-primary-light)] focus:border-[var(--color-primary)]"
              >
                <option value="es">{t('spanish')}</option>
                <option value="en">{t('english')}</option>
              </select>

              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-dim)] transition-all hover:border-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                title={theme === 'dark' ? t('lightMode') : t('darkMode')}
                aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
              >
                {theme === 'dark' ? <SunMedium size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <NotificationCenter />
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="hidden lg:flex w-9 h-9 rounded-full overflow-hidden bg-[var(--color-surface-3)] border border-[var(--color-border)] shadow-sm items-center justify-center text-[11px] font-black text-[var(--color-text-dim)] transition-all hover:border-brand-300 hover:scale-105"
              title={t('goToProfile')}
            >
              {usuario?.fotoPerfilUrl ? (
                <img src={getPublicAssetUrl(usuario.fotoPerfilUrl)} alt={usuario?.nombre} className="h-full w-full object-cover" />
              ) : (
                getInitials(usuario?.nombre)
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 xl:p-12 max-w-[1600px] w-full mx-auto">
          {children}
        </div>
      </main>

      <div
        className={`
          fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99] transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setOpen(false)}
      />
    </div>
  );
};

export default Layout;
