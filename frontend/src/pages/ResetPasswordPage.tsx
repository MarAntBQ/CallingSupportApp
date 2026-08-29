import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/axios';
import { AuthLogo } from '../components/AuthLogo';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const extractMessage = (err: unknown, fallback: string) => {
    const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
    const msg = axiosErr.response?.data?.message;
    return Array.isArray(msg) ? msg.join(' ') : (msg ?? fallback);
  };

  const verifyMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/verify-reset-otp', { email, otpCode })).data,
    onSuccess: () => {
      setError('');
      setStep('password');
    },
    onError: (err: unknown) => setError(extractMessage(err, 'No se pudo verificar el código.')),
  });

  const resetMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/reset-password', { email, newPassword })).data,
    onSuccess: () => {
      navigate('/login', { state: { message: 'Contraseña restablecida. Ya puedes iniciar sesión.' }, replace: true });
    },
    onError: (err: unknown) => setError(extractMessage(err, 'No se pudo restablecer la contraseña.')),
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    resetMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <AuthLogo />
        {step === 'otp' ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[var(--text)]">Verifica el código</h1>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Ingresa el código que enviamos a tu correo para continuar.
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
                {verifyMutation.isPending ? 'Verificando…' : 'Verificar código'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[var(--text)]">Nueva contraseña</h1>
            <p className="mb-6 text-sm text-[var(--text-muted)]">Define tu nueva contraseña para continuar.</p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                />
              </div>

              <button
                type="submit"
                disabled={resetMutation.isPending}
                className="w-full rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
              >
                {resetMutation.isPending ? 'Guardando…' : 'Restablecer contraseña'}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          <Link to="/login" className="font-medium text-[var(--sage-600)] hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
