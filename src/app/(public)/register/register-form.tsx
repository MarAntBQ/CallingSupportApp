'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ErrorCode } from '@/lib/api-client';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';
import { registerSchema } from '@/lib/validation/registration';

type FieldName = 'firstName' | 'lastName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'privacyConsent';
const ORDER: FieldName[] = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword', 'privacyConsent'];
const LINK = 'font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline';

export function RegisterForm({ controllerName, controllerEmail }: { controllerName: string; controllerEmail: string | null }) {
  const t = useTranslations('register');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const consentId = useId();
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function messageFor(field: FieldName, code?: string) {
    if (field === 'firstName' || field === 'lastName') return t('errors.name');
    if (field === 'email') return code === 'email_taken' ? t('errors.emailTaken') : tCommon('invalidEmail');
    if (field === 'phone') return t('errors.phone');
    if (field === 'password') return t('errors.passwordTooShort', { min: PASSWORD_MIN_LENGTH });
    if (field === 'privacyConsent') return t('errors.consentRequired');
    return tCommon('required');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const input = {
      firstName: value('firstName'),
      lastName: value('lastName'),
      email: value('email'),
      phone: value('phone'),
      password: value('password'),
      privacyConsent: form.get('privacyConsent') === 'on',
      locale,
    };
    const next: Partial<Record<FieldName, string>> = {};
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]) as FieldName;
        if (ORDER.includes(field)) next[field] ??= messageFor(field);
      }
    }
    if (value('confirmPassword') !== input.password) next.confirmPassword = t('errors.passwordMismatch');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0 || !parsed.success) {
      const first = ORDER.find((field) => next[field]);
      if (first) requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus());
      return;
    }
    setSubmitting(true);
    const result = await postJson<{ email: string }>('/api/auth/register', parsed.data);
    if (result.ok) {
      router.push(`/verify-otp?email=${encodeURIComponent(parsed.data.email)}`);
      return;
    }
    const codes = Object.fromEntries(result.issues.map((issue) => [issue.field, issue.code]));
    const serverErrors = Object.fromEntries(
      result.fields.filter((field): field is FieldName => ORDER.includes(field as FieldName)).map((field) => [field, messageFor(field, codes[field])]),
    );
    setErrors(serverErrors);
    setFormError(result.error);
    setSubmitting(false);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {formError && <Alert tone="danger" role="alert" title={tErrors(formError)} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('firstName')} name="firstName" autoComplete="given-name" required error={errors.firstName} />
        <Field label={t('lastName')} name="lastName" autoComplete="family-name" required error={errors.lastName} />
      </div>
      <Field label={t('email')} name="email" type="email" autoComplete="email" required error={errors.email} />
      <Field label={t('phone')} name="phone" type="tel" autoComplete="tel" error={errors.phone} />
      <Field
        label={t('password')}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t('passwordHint', { min: PASSWORD_MIN_LENGTH })}
        required
        error={errors.password}
      />
      <Field label={t('confirmPassword')} name="confirmPassword" type="password" autoComplete="new-password" required error={errors.confirmPassword} />
      <section aria-labelledby={`${consentId}-title`} className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4">
        <h2 id={`${consentId}-title`} className="text-base font-semibold text-text">
          {t('privacy.title')}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
          <li>
            {t('privacy.controller', { name: controllerName })}
            {controllerEmail && <> {t('privacy.controllerContact', { email: controllerEmail })}</>}
          </li>
          <li>{t('privacy.what')}</li>
          <li>{t('privacy.use')}</li>
          <li>{t('privacy.retention')}</li>
        </ul>
        <Link href="/privacy" target="_blank" className={`${LINK} text-sm`}>
          {t('privacy.link')}
        </Link>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={consentId} className="flex items-start gap-2 text-base text-text">
            <input
              id={consentId}
              type="checkbox"
              name="privacyConsent"
              aria-invalid={errors.privacyConsent ? true : undefined}
              aria-describedby={errors.privacyConsent ? `${consentId}-error` : undefined}
              className="mt-1 size-4 accent-primary"
            />
            {t('privacy.consent')}
          </label>
          {errors.privacyConsent && (
            <p id={`${consentId}-error`} className="pl-6 text-sm text-danger-strong">
              {errors.privacyConsent}
            </p>
          )}
        </div>
      </section>
      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
