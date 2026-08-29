import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/axios';
import { AuthLogo } from '../components/AuthLogo';

const schema = z.object({ email: z.string().email('Correo inválido') });
type FormValues = z.infer<typeof schema>;

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => (await api.post('/auth/forgot-password', data)).data,
    onSuccess: (_data, variables) => {
      navigate(`/reset-password?email=${encodeURIComponent(variables.email)}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo enviar la solicitud.'));
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <AuthLogo />
        <h1 className="mb-1 text-lg font-semibold text-[var(--text)]">Recuperar contraseña</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Ingresa tu correo y te enviaremos un código de verificación.
        </p>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4" noValidate>
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

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {mutation.isPending ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          <Link to="/login" className="font-medium text-[var(--sage-600)] hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
