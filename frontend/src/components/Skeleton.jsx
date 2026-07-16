const shimmer = {
  background: 'linear-gradient(90deg, rgba(148,163,184,0.08) 25%, rgba(148,163,184,0.18) 50%, rgba(148,163,184,0.08) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.5s infinite linear',
};

export const SkeletonBlock = ({ width = '100%', height = 16, radius = 12, style = {} }) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius,
      ...shimmer,
      ...style,
    }}
  />
);

export const SkeletonText = ({ lines = 3, widths = ['100%', '92%', '68%'] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonBlock key={index} height={12} width={widths[index] || widths[widths.length - 1] || '100%'} radius={999} />
    ))}
  </div>
);

export const PageSkeleton = ({ cards = 3, showSidebar = true }) => (
  <div style={{ width: '100%' }}>
    <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <SkeletonBlock width="220px" height={16} radius={999} />
          <SkeletonBlock width="min(520px, 100%)" height={44} radius={18} />
          <SkeletonBlock width="min(420px, 100%)" height={16} radius={999} />
        </div>
        <SkeletonBlock width="180px" height={54} radius={20} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cards}, minmax(0, 1fr))`, gap: '1rem', marginBottom: '2rem' }}>
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SkeletonBlock width="54px" height={54} radius={18} />
            <SkeletonBlock width="72px" height={30} radius={14} />
            <SkeletonBlock width="120px" height={12} radius={999} />
            <SkeletonBlock width="88px" height={12} radius={999} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showSidebar ? '2fr 1fr' : '1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <SkeletonBlock width="220px" height={20} radius={999} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <SkeletonBlock width="44px" height={44} radius={14} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <SkeletonBlock width={`${78 - index * 4}%`} height={14} radius={999} />
                <SkeletonBlock width={`${52 - index * 3}%`} height={12} radius={999} />
              </div>
            </div>
          ))}
        </div>

        {showSidebar && (
          <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SkeletonBlock width="170px" height={20} radius={999} />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <SkeletonBlock width={`${88 - index * 8}%`} height={14} radius={999} />
                <SkeletonBlock width={`${68 - index * 8}%`} height={12} radius={999} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const AuthSkeleton = ({ compact = false }) => (
  <div style={{ minHeight: compact ? '320px' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: compact ? 'transparent' : 'var(--color-bg-base)' }}>
    <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    <div style={{ width: '100%', maxWidth: compact ? '440px' : '520px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '28px', padding: compact ? '2rem' : '2.5rem', boxShadow: '0 20px 45px -12px rgba(15,23,42,0.08)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <SkeletonBlock width="72px" height={72} radius={24} />
        <SkeletonBlock width="240px" height={26} radius={14} />
        <SkeletonBlock width="70%" height={14} radius={999} />
      </div>
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SkeletonBlock width="100%" height={54} radius={16} />
        <SkeletonBlock width="100%" height={54} radius={16} />
        <SkeletonBlock width="100%" height={54} radius={16} />
      </div>
    </div>
  </div>
);

export const PanelSkeleton = ({ rows = 4, titleWidth = '180px' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    <SkeletonBlock width={titleWidth} height={22} radius={999} />
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} style={{ padding: '1rem', borderRadius: '18px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <SkeletonBlock width={`${84 - index * 6}%`} height={14} radius={999} />
        <SkeletonBlock width={`${58 - index * 5}%`} height={12} radius={999} />
      </div>
    ))}
  </div>
);

export default PageSkeleton;
