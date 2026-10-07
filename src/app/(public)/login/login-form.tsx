'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ErrorCode } from '@/lib/api-client';

export function LoginForm({ message }: { message?: string }) {
  const t = useTranslations('login');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const rememberId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    const result = await postJson('/api/auth/login', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      rememberMe: form.get('rememberMe') === 'on',
    });
    if (result.ok) {
      router.replace('/admin');
      router.refresh();
      return;
    }
    setError(result.error);
    setSubmitting(false);
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
