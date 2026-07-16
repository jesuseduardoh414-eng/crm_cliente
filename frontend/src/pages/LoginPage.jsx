// Página de Login
// Formulario de email/password — guarda el JWT y redirige al dashboard

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { BRAND_NAME } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

const LoginPage = () => {
  const navigate       = useNavigate();
  const { login }      = useAuth();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError]     = useState('');
  const [cargando, setCargando] = useState(false);

  // Actualizar campo del formulario
  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(''); // Limpiar error al escribir
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      const data = await authService.login(form.email, form.password);
      login(data.token, data.usuario); // Guardar en contexto y localStorage
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 lg:p-8">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">

        {/* Marca / Título */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <span aria-hidden="true" className="h-8 w-2 shrink-0 rounded bg-accent-400" />
            <span className="min-w-0 break-words text-3xl lg:text-4xl font-black uppercase leading-tight tracking-tight text-brand-600">
              {BRAND_NAME}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Panel Interno
          </h1>
          <p className="text-slate-400 font-medium mt-1 text-sm lg:text-base">
            Inicia sesión para continuar
          </p>
        </div>

        {/* Tarjeta del formulario */}
        <div className="bg-white p-8 lg:p-10 rounded-[32px] shadow-2xl shadow-slate-200 border border-slate-50">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Error global */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-500 p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center animate-shake">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1" htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@empresa.com"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            {/* Password */}
            <div className="space-y-2 relative">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest" htmlFor="password">Contraseña</label>
                <Link to="/forgot-password" size={18} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:text-brand-700 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={verPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none pr-12"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors p-1"
                >
                  {verPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 mt-2"
              disabled={cargando}
            >
              {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
