'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { issueCode, postRaw } from '@/lib/post-raw';
import { verifyOtpSchema } from '@/lib/validation/registration';

export function VerifyOtpForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('verifyOtp');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<{ field: 'email' | 'code' | 'form'; message: string; tone?: 'info' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = verifyOtpSchema.safeParse({ email, code });
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0]);
      setError(field === 'email' ? { field: 'email', message: tCommon('invalidEmail') } : { field: 'code', message: t('errors.code') });
      return;
    }
    setSubmitting(true);
    setError(null);
    const { status, body } = await postRaw('/api/auth/verify-otp', parsed.data);
    setSubmitting(false);
    if (status === 200) {
      router.push('/login?message=account_verified');
      return;
    }
    const reason = issueCode(body);
    setCode('');
    if (status === 404) setError({ field: 'form', message: t('errors.notFound') });
    else if (reason === 'wrong_code') setError({ field: 'code', message: t('errors.wrong', { remaining: Number(body?.remaining ?? 0) }) });
    else if (reason === 'code_renewed') setError({ field: 'form', message: t('errors.renewed'), tone: 'info' });
    else if (reason === 'already_active') setError({ field: 'form', message: t('errors.alreadyActive'), tone: 'info' });
    else setError({ field: 'form', message: tErrors(status === 429 ? 'rate_limited' : status === 0 ? 'network' : 'unknown') });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-text-muted">{t('intro')}</p>
      {error?.field === 'form' && <Alert tone={error.tone ?? 'danger'} role="alert" title={error.message} />}
      <Field label={t('email')} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error?.field === 'email' ? error.message : undefined} required />
      <Field
        label={t('code')}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="\d{6}"
        hint={t('codeHint')}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        error={error?.field === 'code' ? error.message : undefined}
        required
      />
      <Button type="submit" disabled={submitting || code.length !== 6}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
