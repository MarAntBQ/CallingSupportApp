'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postRaw } from '@/lib/post-raw';
import { forgotPasswordSchema } from '@/lib/validation/registration';

export function ForgotPasswordForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('forgotPassword');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(tCommon('invalidEmail'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setFormError(null);
    const { status } = await postRaw('/api/auth/forgot-password', parsed.data);
    setSubmitting(false);
    if (status === 200) {
      router.push(`/reset-password?email=${encodeURIComponent(parsed.data.email)}`);
      return;
    }
    setFormError(tErrors(status === 429 ? 'rate_limited' : status === 0 ? 'network' : 'unknown'));
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-text-muted">{t('intro')}</p>
      {formError && <Alert tone="danger" role="alert" title={formError} />}
      <Field label={t('email')} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error ?? undefined} required />
      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
