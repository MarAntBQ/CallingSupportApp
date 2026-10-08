'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ErrorCode } from '@/lib/api-client';

type LoginResponse = { mfaRequired?: boolean; challengeId?: string };

export function LoginForm({ message }: { message?: string }) {
  const t = useTranslations('login');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const rememberId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  function enterPanel() {
    router.replace('/admin');
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    const result = await postJson<LoginResponse>('/api/auth/login', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      rememberMe: form.get('rememberMe') === 'on',
    });
    if (result.ok && result.data?.mfaRequired && result.data.challengeId) {
      setChallengeId(result.data.challengeId);
      setSubmitting(false);
      return;
    }
    if (result.ok) {
      enterPanel();
      return;
    }
    setError(result.error);
    setSubmitting(false);
  }

  if (challengeId) {
    return (
      <SecondStep
        challengeId={challengeId}
        onDone={enterPanel}
        onRestart={(code) => {
          setChallengeId(null);
          setError(code);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {message && !error && (
        <Alert tone="success" role="status" title={message} />
      )}
      {error && <Alert tone="danger" role="alert" title={tErrors(error)} />}
      <Field label={t('email')} name="email" type="email" autoComplete="email" required />
      <Field
        label={t('password')}
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        required
        trailing={
          <Button
            variant="link"
            className="text-sm"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? t('hidePassword') : t('showPassword')}
          </Button>
        }
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={rememberId} className="flex items-center gap-2 text-base text-text">
          <input id={rememberId} type="checkbox" name="rememberMe" className="size-4 accent-primary" aria-describedby={`${rememberId}-help`} />
          {t('rememberMe')}
        </label>
        <p id={`${rememberId}-help`} className="pl-6 text-sm text-text-muted">
          {t('rememberMeHelp')}
        </p>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

// Segundo paso (#36): el código de 6 dígitos de la aplicación o un código de recuperación.
function SecondStep({
  challengeId,
  onDone,
  onRestart,
}: {
  challengeId: string;
  onDone: () => void;
  onRestart: (error: ErrorCode | null) => void;
}) {
  const t = useTranslations('login.mfa');
  const tErrors = useTranslations('errors');
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await postJson('/api/auth/mfa/verify', useRecovery ? { challengeId, recoveryCode: value } : { challengeId, code: value.trim() });
    if (result.ok) {
      onDone();
      return;
    }
    setSubmitting(false);
    if (result.error === 'challenge_expired' || result.error === 'rate_limited') {
      onRestart(result.error);
      return;
    }
    setError(result.error === 'invalid_input' ? t('incorrect') : tErrors(result.error));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-testid="mfa-step">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-text">{t('title')}</h2>
        <p className="text-sm text-text-muted">{useRecovery ? t('recoveryIntro') : t('intro')}</p>
      </div>
      {useRecovery ? (
        <Field
          key="recovery"
          label={t('recoveryCode')}
          name="recoveryCode"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={error ?? undefined}
          autoFocus
          required
        />
      ) : (
        <Field
          key="code"
          label={t('code')}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
          error={error ?? undefined}
          autoFocus
          required
        />
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Button
          variant="link"
          onClick={() => {
            setUseRecovery((current) => !current);
            setValue('');
            setError(null);
          }}
        >
          {useRecovery ? t('useApp') : t('useRecovery')}
        </Button>
        <Button variant="link" onClick={() => onRestart(null)}>
          {t('back')}
        </Button>
      </div>
    </form>
  );
}
