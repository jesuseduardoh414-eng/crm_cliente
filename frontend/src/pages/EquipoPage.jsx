// Página Mi Equipo — vista por proyecto
// ADMIN: ve el equipo de cada proyecto (todos los proyectos)
// MIEMBRO: ve el equipo de sus proyectos asignados

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { proyectosService } from '../services/api';
import { PageSkeleton } from '../components/Skeleton';
import UserAvatar from '../components/UserAvatar';
import { usePreferences } from '../context/PreferencesContext';
import {
  ShoppingCart,
  Warehouse,
  Truck,
  Forklift,
  Wrench,
  BarChart3,
  User,
  ChevronDown,
  ClipboardList,
  Zap,
  CheckCircle2
} from 'lucide-react';

const AREA_CONF = {
  VENTAS:         { labelKey: 'areaVentas',         color: 'var(--color-primary)', bg: 'rgb(var(--brand-600) / 0.08)', icon: <ShoppingCart size={16} /> },
  ALMACEN:        { labelKey: 'areaAlmacen',        color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   icon: <Warehouse size={16} /> },
  COMPRAS:        { labelKey: 'areaCompras',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  icon: <Truck size={16} /> },
  ADMINISTRACION: { labelKey: 'areaAdministracion', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: <BarChart3 size={16} /> },
  RENTA:          { labelKey: 'areaRenta',          color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   icon: <Forklift size={16} /> },
  TALLER:         { labelKey: 'areaTaller',         color: '#db2777', bg: 'rgba(219,39,119,0.08)',  icon: <Wrench size={16} /> },
};

const ROL_CONF = {
  ADMIN:   { labelKey: 'roleAdmin',   color: '#818cf8', bg: 'rgba(129,140,248,0.08)' },
  MIEMBRO: { labelKey: 'roleMember',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};

const ESTADO_COLOR = {
  ACTIVO:   '#34d399',
  EN_PAUSA: '#f59e0b',
  CERRADO:  '#94a3b8',
};

// —— Tarjeta de miembro —————————————————————————————————————————————————————
const MiembroCard = ({ miembro }) => {
  const { t } = usePreferences();
  const areaConf = AREA_CONF[miembro.area] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: <User size={16} />, labelKey: 'areaGeneral' };
  const rolConf  = ROL_CONF[miembro.rol] || ROL_CONF.MIEMBRO;
  const pct      = miembro.tareas.total > 0
    ? Math.round((miembro.tareas.hechas / miembro.tareas.total) * 100)
    : 0;

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '1.5rem',
      padding: '1.5rem',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'default',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}
    onMouseOver={e => { 
      e.currentTarget.style.transform = 'translateY(-4px)'; 
      e.currentTarget.style.boxShadow = 'var(--shadow-xl)'; 
      e.currentTarget.style.borderColor = 'var(--color-primary-20)'; 
    }}
    onMouseOut={e => { 
      e.currentTarget.style.transform = 'translateY(0)'; 
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'; 
      e.currentTarget.style.borderColor = 'var(--color-border)'; 
    }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <UserAvatar
          usuario={miembro}
          size={48}
          radius={14}
          color={areaConf.color}
          background={areaConf.bg}
          borderColor={`${areaConf.color}30`}
          fontSize="1.15rem"
          shadow={`0 8px 16px ${areaConf.color}15`}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
            {miembro.nombre}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>
            {miembro.email}
          </div>
        </div>
      </div>

      {/* Badges área + rol */}
      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{
          padding: '0.25rem 0.75rem', borderRadius: '999px',
          fontSize: '0.8rem', fontWeight: '800',
          background: areaConf.bg, color: areaConf.color,
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          border: `1px solid ${areaConf.color}20`
        }}>
          {areaConf.icon}
          <span style={{ position: 'relative', top: '0.5px' }}>{t(areaConf.labelKey)}</span>
        </span>
        <span style={{
          padding: '0.25rem 0.75rem', borderRadius: '999px',
          fontSize: '0.8rem', fontWeight: '800',
          background: rolConf.bg, color: rolConf.color,
          border: `1px solid ${rolConf.color}20`,
          display: 'flex', alignItems: 'center'
        }}>
          <span style={{ position: 'relative', top: '0.5px' }}>{t(rolConf.labelKey)}</span>
        </span>
      </div>

      {/* Barra de progreso tareas */}
      {miembro.tareas.total > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: '0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            <span>{miembro.tareas.hechas}/{miembro.tareas.total} {t('teamTasksPlural')}</span>
            <span style={{ color: pct === 100 ? '#34d399' : areaConf.color }}>{pct}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--color-surface-3)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '999px',
              width: `${pct}%`,
              background: pct === 100 ? '#34d399' : areaConf.color,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600' }}><ClipboardList size={14} strokeWidth={2.5} /> {miembro.tareas.pendientes}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600' }}><Zap size={14} strokeWidth={2.5} /> {miembro.tareas.enProgreso}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600' }}><CheckCircle2 size={14} strokeWidth={2.5} /> {miembro.tareas.hechas}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// —— Sección de proyecto —————————————————————————————————————————————————————
const ProyectoEquipo = ({ proyecto, equipoData }) => {
  const { t } = usePreferences();
  const [open, setOpen] = useState(true);
  const estadoColor = ESTADO_COLOR[proyecto.estado] || '#94a3b8';
  const areaConf    = AREA_CONF[proyecto.creador?.area] || AREA_CONF.VENTAS;

  return (
    <div style={{
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      borderRadius: '1rem', overflow: 'hidden',
    }}>
      {/* Cabecera del proyecto — clickeable para colapsar */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '1rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--color-border)' : 'none',
          textAlign: 'left',
        }}
      >
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: estadoColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
            {proyecto.nombre}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: '0.15rem', fontWeight: '600' }}>
            {equipoData.length} {equipoData.length !== 1 ? t('teamMemberPlural') : t('teamMemberSingular')}
          </div>
        </div>
        <span style={{
          padding: '0.35rem 0.85rem', borderRadius: '12px',
          fontSize: '0.7rem', fontWeight: '900',
          background: areaConf.bg, color: areaConf.color, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          border: `1.2px solid ${areaConf.color}30`,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          whiteSpace: 'nowrap'
        }}>
          {areaConf.icon && <span style={{ display: 'flex', opacity: 0.8 }}>{areaConf.icon}</span>}
          {t(areaConf.labelKey)}
        </span>
        <span style={{ color: 'var(--color-text-dim)', display: 'flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0 }}><ChevronDown size={18} strokeWidth={2.5} /></span>
      </button>

      {/* Equipo del proyecto */}
      {open && (
        <div style={{ padding: '1rem 1.25rem' }}>
          {equipoData.length === 0 ? (
            <div style={{
              padding: '1.5rem', textAlign: 'center',
              border: '1px dashed var(--color-border)', borderRadius: '0.6rem',
              color: 'var(--color-text-muted)', fontSize: '0.8rem',
            }}>
              {t('teamNoMembers')}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}>
              {equipoData.map(m => <MiembroCard key={m.id} miembro={m} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// —— Página principal ————————————————————————————————————————————————————————
const EquipoPage = () => {
  const { t } = usePreferences();
  const { usuario }               = useAuth();
  const [datos, setDatos]         = useState([]); // [{ proyecto, equipo }]
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');
  const esAdmin = usuario?.rol === 'ADMIN';

  useEffect(() => {
    const cargar = async () => {
      try {
        const { proyectos } = await proyectosService.listar();
        // Para cada proyecto cargar su equipo
        const resultados = await Promise.all(
          proyectos.map(async (p) => {
            const data = await proyectosService.equipoDeProyecto(p.id);
            return { proyecto: p, equipo: data.equipo };
          })
        );
        setDatos(resultados);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const totalMiembros = new Set(datos.flatMap(d => d.equipo.map(m => m.id))).size;

  if (cargando) {
    return <PageSkeleton cards={3} showSidebar={false} />;
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '900', marginBottom: '0.25rem' }}>{t('teamTitle')}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.15rem' }}>
          {esAdmin
            ? t('teamSummary', { members: totalMiembros, memberLabel: totalMiembros !== 1 ? t('teamMemberPlural') : t('teamMemberSingular'), projects: datos.length, projectLabel: datos.length !== 1 ? t('teamProjectPlural') : t('teamProjectSingular') })
            : `${t('projectList')} ${datos.length} ${datos.length !== 1 ? t('teamProjectPlural') : t('teamProjectSingular')}`
          }
        </p>
      </div>

      {error ? (
        <div className="alert-error">{error}</div>
      ) : datos.length === 0 ? (
        <div style={{
          padding: '3rem', textAlign: 'center',
          background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)',
          borderRadius: '1rem', color: 'var(--color-text-muted)',
        }}>
          {t('teamNoProjects')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {datos.map(({ proyecto, equipo }) => (
            <ProyectoEquipo key={proyecto.id} proyecto={proyecto} equipoData={equipo} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EquipoPage;

