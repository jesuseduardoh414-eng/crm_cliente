// Spinner de carga reutilizable
const Spinner = ({ texto = 'Cargando...' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '1.25rem', padding: '5rem 2rem',
    color: 'var(--color-text-muted)',
    width: '100%',
  }}>
    <div style={{
      position: 'relative',
      width: '42px', height: '42px',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        border: '3px solid rgb(var(--brand-600) / 0.1)',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        border: '3px solid transparent',
        borderTop: '3px solid var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      }} />
    </div>
    <span style={{ fontSize: '0.9rem', fontWeight: '500', letterSpacing: '0.01em' }}>{texto}</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default Spinner;
