'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { issueCode, postRaw } from '@/lib/post-raw';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';
import { RESET_WINDOW_MINUTES, verifyResetOtpSchema } from '@/lib/validation/registration';

const LINK = 'font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline';

export function ResetPasswordForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('resetPassword');
  const tForgot = useTranslations('forgotPassword');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const serverError = (status: number) => tErrors(status === 429 ? 'rate_limited' : status === 0 ? 'network' : 'unknown');

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = verifyResetOtpSchema.safeParse({ email, code });
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0]);
      setFieldError(field === 'email' ? { field, message: tCommon('invalidEmail') } : { field: 'code', message: t('errors.code') });
      return;
    }
    setSubmitting(true);
    setFieldError(null);
    setFormError(null);
    const { status, body } = await postRaw('/api/auth/verify-reset-otp', parsed.data);
    setSubmitting(false);
    if (status === 200 && typeof body?.token === 'string') {
      setToken(body.token);
      return;
    }
    setCode('');
    const reason = issueCode(body);
    if (reason === 'wrong_code') setFieldError({ field: 'code', message: t('errors.wrong', { remaining: Number(body?.remaining ?? 0) }) });
    else if (reason === 'too_many_tries') setFormError(t('errors.tooMany'));
    else if (reason === 'no_pending_code') setFormError(t('errors.noPending'));
    else setFormError(serverError(status));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setFieldError({ field: 'newPassword', message: t('errors.passwordTooShort', { min: PASSWORD_MIN_LENGTH }) });
      return;
    }
    if (confirm !== password) {
      setFieldError({ field: 'confirmPassword', message: t('errors.passwordMismatch') });
      return;
    }
    setSubmitting(true);
    setFieldError(null);
    setFormError(null);
    const { status, body } = await postRaw('/api/auth/reset-password', { email, token, newPassword: password });
    setSubmitting(false);
    if (status === 200) {
      router.push('/login?message=password_reset');
      return;
    }
    if (issueCode(body) === 'reset_expired') {
      setToken(null);
      setPassword('');
      setConfirm('');
      setFormError(t('errors.expired', { minutes: RESET_WINDOW_MINUTES }));
      return;
    }
    setFormError(serverError(status));
  }

  const error = (field: string) => (fieldError?.field === field ? fieldError.message : undefined);

  return (
    <div className="flex flex-col gap-5">
      {formError && (
        <Alert tone="danger" role="alert" title={formError}>
          <Link href={`/forgot-password?email=${encodeURIComponent(email)}`} className={LINK}>
            {t('requestNew')}
          </Link>
        </Alert>
      )}
      {!token ? (
        <form noValidate onSubmit={verify} className="flex flex-col gap-5">
          <p className="text-text-muted">{t('codeIntro')}</p>
          <Field label={t('email')} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error('email')} required />
          <Field
            label={t('code')}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            error={error('code')}
            required
          />
          <Button type="submit" disabled={submitting || code.length !== 6}>
            {submitting ? t('verifying') : t('verify')}
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={save} className="flex flex-col gap-5">
          <p className="text-text-muted">{t('passwordIntro')}</p>
          <Field
            label={t('newPassword')}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint={t('newPasswordHint', { min: PASSWORD_MIN_LENGTH })}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error('newPassword')}
            required
          />
          <Field
            label={t('confirmPassword')}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={error('confirmPassword')}
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      )}
      <p className="text-sm text-text-muted">{tForgot('sent')}</p>
    </div>
  );
}
