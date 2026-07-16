import { getPublicAssetUrl } from '../services/api';

const getInitials = (nombre = '') => (
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('') || '?'
);

const UserAvatar = ({
  usuario,
  nombre,
  fotoPerfilUrl,
  size = 48,
  radius = 14,
  color = 'var(--color-primary)',
  background = 'rgb(var(--brand-600) / 0.08)',
  borderColor = 'rgb(var(--brand-600) / 0.18)',
  fontSize = '1rem',
  shadow = 'none',
}) => {
  const displayName = nombre || usuario?.nombre || '';
  const displayPhoto = fotoPerfilUrl ?? usuario?.fotoPerfilUrl ?? '';
  const resolvedPhoto = getPublicAssetUrl(displayPhoto);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${radius}px`,
        flexShrink: 0,
        overflow: 'hidden',
        background,
        border: `1.5px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '900',
        fontSize,
        color,
        boxShadow: shadow,
      }}
    >
      {resolvedPhoto ? (
        <img
          src={resolvedPhoto}
          alt={displayName || 'Usuario'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        getInitials(displayName)
      )}
    </div>
  );
};

export default UserAvatar;
