import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/api';
import { BRAND_NAME } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { AuthSkeleton } from '../components/Skeleton';

const InvitationPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invitacion, setInvitacion] = useState(null);
  const [form, setForm] = useState({ password: '', confirmar_password: '' });
  const [verPassword, setVerPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvitacion = async () => {
      try {
        const data = await authService.verificarInvitacion(token);
        setInvitacion(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvitacion();
  }, [token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const getPasswordStrength = (pass) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength += 1;
    if (/[A-Z]/.test(pass)) strength += 1;
    if (/[0-9]/.test(pass)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmar_password) {
      return alert('Las contraseñas no coinciden');
    }
    if (form.password.length < 8) {
      return alert('La contraseña debe tener al menos 8 caracteres');
    }

    setSubmitting(true);
    try {
      const data = await authService.aceptarInvitacion(token, form);
      login(data.token, data.usuario);
      navigate('/dashboard');
    } catch (err) {
      alert(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AuthSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-gray-600 mb-8">
            Este enlace de invitación ha expirado o no es válido.
            Contacta a tu administrador para recibir una nueva invitación.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const strength = getPasswordStrength(form.password);
  const strengthColors = ['bg-gray-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span aria-hidden="true" className="h-7 w-1.5 shrink-0 rounded bg-accent-400" />
            <span className="min-w-0 break-words text-2xl lg:text-3xl font-black uppercase leading-tight tracking-tight text-brand-600">
              {BRAND_NAME}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Activa tu cuenta</h1>
          <p className="text-slate-500 mt-2">Completa tu perfil para unirte al equipo</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <ShieldCheck className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Invitación para</p>
                <p className="text-xl font-semibold">{invitacion?.nombre}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed">
                  {invitacion?.email}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Área</label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed">
                  {invitacion?.area}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="space-y-1.5 relative">
                <label className="text-sm font-semibold text-slate-700">Crear contraseña</label>
                <input
                  type={verPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600"
                >
                  {verPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>

                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= strength ? strengthColors[strength] : 'bg-slate-100'}`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                  {strength === 0 && 'Ingresa una contraseña'}
                  {strength === 1 && 'Contraseña muy débil'}
                  {strength === 2 && 'Contraseña aceptable'}
                  {strength === 3 && 'Contraseña fuerte'}
                  {strength >= 4 && 'Contraseña excelente'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                <input
                  type={verPassword ? 'text' : 'password'}
                  name="confirmar_password"
                  required
                  placeholder="Repite tu contraseña"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                  value={form.confirmar_password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || strength < 2}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${
                submitting || strength < 2
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-brand-600 to-brand-800 hover:from-brand-700 hover:to-brand-900'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Activando cuenta...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Activar mi cuenta
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              Al activar tu cuenta, aceptas los términos de uso y políticas de privacidad del CRM.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InvitationPage;
