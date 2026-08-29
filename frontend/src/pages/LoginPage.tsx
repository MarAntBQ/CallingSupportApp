import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { setSession } from '../lib/auth';
import { AuthLogo } from '../components/AuthLogo';

const schema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Requerido'),
  rememberMe: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface LoginResponse {
  token: string;
  usuario: { id: number; nombres: string; apellidos: string; email: string; role: string; modulosPermitidos: string[] };
}

const EyeIcon = ({ hidden }: { hidden: boolean }) =>
  hidden ? (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M2 10s2.8-5.5 8-5.5S18 10 18 10s-2.8 5.5-8 5.5S2 10 2 10Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path
        d="M2.5 2.5l15 15M8.4 8.53a2.25 2.25 0 0 0 3.07 3.07M6.2 6.32C3.9 7.65 2 10 2 10s2.8 5.5 8 5.5c1.44 0 2.7-.42 3.76-1.02M11.9 4.83A8.6 8.6 0 0 1 10 4.5c5.2 0 8 5.5 8 5.5a13.4 13.4 0 0 1-2.32 3.03"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message;

  const configQuery = useQuery({
    queryKey: ['config', 'public'],
    queryFn: async () => (await api.get<{ permitirRegistro: boolean; nombreUnidad: string }>('/config')).data,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { rememberMe: false } });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { data: res } = await api.post<LoginResponse>('/auth/login', data);
      return res;
    },
    onSuccess: (data) => {
      setSession(data.token, data.usuario);
      navigate('/admin', { replace: true });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo iniciar sesión.'));
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <AuthLogo />
        <h1 className="mb-1 text-lg font-semibold text-[var(--text)]">Panel de administración</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">Inicia sesión para continuar.</p>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4" noValidate>
          {successMessage && (
            <div className="rounded-lg border border-[var(--sage-600)]/30 bg-[var(--sage-600)]/10 px-3.5 py-2.5 text-sm text-[var(--sage-600)]">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Correo</label>
            <input
              type="email"
              {...register('email')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
            {errors.email && <p className="mt-1 text-xs text-[var(--danger)]">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-[var(--danger)]">{errors.password.message}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              {...register('rememberMe')}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
            />
            Recordar mi sesión
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <Link to="/forgot-password" className="font-medium text-[var(--sage-600)] hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          {configQuery.data?.permitirRegistro && (
            <p className="text-[var(--text-muted)]">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-medium text-[var(--sage-600)] hover:underline">
                Regístrate
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
