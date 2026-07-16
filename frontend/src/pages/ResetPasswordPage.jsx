import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { useToast } from '../context/ToastContext';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return showToast('Las contraseñas no coinciden', 'error');
    }

    setCargando(true);
    try {
      await authService.resetPassword(token, password);
      showToast('Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
      navigate('/login');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#ffffff', padding: '1.5rem'
    }}>
      <div style={{ 
        width: '100%', maxWidth: '400px', background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: '1.5rem', padding: '2.5rem', boxShadow: 'var(--shadow-xl)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--color-text)' }}>Nueva Contraseña</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Ingresa tu nueva clave de acceso segura.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Nueva Contraseña</label>
            <input 
              type="password" className="form-input" required minLength={8}
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Contraseña</label>
            <input 
              type="password" className="form-input" required
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          <div style={{ 
            fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)',
            padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <p style={{ marginBottom: '0.25rem', fontWeight: '700' }}>Requisitos de seguridad:</p>
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li>Mínimo 8 caracteres</li>
              <li>Mayúsculas, minúsculas y números</li>
              <li>Al menos un carácter especial (!@#$...)</li>
            </ul>
          </div>

          <button type="submit" disabled={cargando} className="btn-primary" style={{ padding: '0.875rem' }}>
            {cargando ? 'Actualizando...' : 'Restablecer contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
