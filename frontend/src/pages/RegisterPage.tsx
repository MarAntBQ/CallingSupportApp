import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { AuthLogo } from '../components/AuthLogo';

const schema = z
  .object({
    nombres: z.string().min(2, 'Mínimo 2 caracteres'),
    apellidos: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().email('Correo inválido'),
    telefono: z.string().optional(),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const configQuery = useQuery({
    queryKey: ['config', 'public'],
    queryFn: async () => (await api.get<{ permitirRegistro: boolean; nombreUnidad: string }>('/config')).data,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { confirmPassword: _confirmPassword, ...payload } = data;
      const { data: res } = await api.post('/auth/register', payload);
      return res;
    },
    onSuccess: (_data, variables) => {
      navigate(`/verify-otp?email=${encodeURIComponent(variables.email)}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo crear la cuenta.'));
    },
  });

  if (configQuery.isSuccess && !configQuery.data.permitirRegistro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <AuthLogo />
          <h1 className="mb-2 text-lg font-semibold text-[var(--text)]">Registro deshabilitado</h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            El registro de nuevos usuarios no está habilitado en este momento.
          </p>
          <Link to="/login" className="text-sm font-medium text-[var(--sage-600)] hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <AuthLogo />
        <h1 className="mb-1 text-lg font-semibold text-[var(--text)]">Crear cuenta</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">Completa tus datos para registrarte.</p>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4" noValidate>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nombres</label>
              <input
                type="text"
                {...register('nombres')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.nombres && <p className="mt-1 text-xs text-[var(--danger)]">{errors.nombres.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Apellidos</label>
              <input
                type="text"
                {...register('apellidos')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.apellidos && <p className="mt-1 text-xs text-[var(--danger)]">{errors.apellidos.message}</p>}
            </div>
          </div>

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
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Teléfono (opcional)</label>
            <input
              type="text"
              {...register('telefono')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Contraseña</label>
            <input
              type="password"
              {...register('password')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
            {errors.password && <p className="mt-1 text-xs text-[var(--danger)]">{errors.password.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Confirmar contraseña</label>
            <input
              type="password"
              {...register('confirmPassword')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-[var(--danger)]">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {mutation.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-[var(--sage-600)] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
