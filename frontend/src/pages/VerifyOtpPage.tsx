import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/axios';
import { AuthLogo } from '../components/AuthLogo';

export const VerifyOtpPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!searchParams.get('email')) return;
    setEmail(searchParams.get('email') ?? '');
  }, [searchParams]);

  const verifyMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/verify-otp', { email, otpCode })).data,
    onSuccess: () => {
      navigate('/login', { state: { message: 'Cuenta activada correctamente. Ya puedes iniciar sesión.' }, replace: true });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo verificar el código.'));
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <AuthLogo />
        <h1 className="mb-1 text-lg font-semibold text-[var(--text)]">Verifica tu cuenta</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Ingresa el código de 6 dígitos que enviamos a tu correo.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            verifyMutation.mutate();
          }}
          className="space-y-4"
          noValidate
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Código de verificación</label>
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
          </div>

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="w-full rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {verifyMutation.isPending ? 'Verificando…' : 'Verificar cuenta'}
          </button>

          <p className="text-center text-xs text-[var(--text-muted)]">
            Si agotas los intentos, el sistema te envía un código nuevo por correo automáticamente.
          </p>
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
