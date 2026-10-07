'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ErrorCode } from '@/lib/api-client';
import { PASSWORD_MIN_LENGTH, setupSchema } from '@/lib/validation/auth';

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'bishopApproved'
  | 'bishopApprovedBy'
  | 'bishopApprovedOn';

export function SetupForm({ today }: { today: string }) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const approvalId = useId();
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function messageFor(field: string, code?: string) {
    if (field === 'email') return tCommon('invalidEmail');
    if (field === 'password') return t('passwordTooShort', { min: PASSWORD_MIN_LENGTH });
    if (field === 'bishopApproved') return t('bishopApprovedRequired');
    if (field === 'bishopApprovedOn' && code === 'future_date') return t('futureDate');
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
      password: value('password'),
      bishopApproved: form.get('bishopApproved') === 'on',
      bishopApprovedBy: value('bishopApprovedBy'),
      bishopApprovedOn: value('bishopApprovedOn'),
    };

    const next: Partial<Record<FieldName, string>> = {};
    const parsed = setupSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]) as FieldName;
        next[field] ??= messageFor(field, issue.message);
      }
    }
    if (value('confirmPassword') !== input.password) next.confirmPassword = t('passwordMismatch');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const result = await postJson('/api/setup', input);
    if (result.ok) {
      router.replace('/admin');
      router.refresh();
      return;
    }
    if (result.status === 404) {
      router.replace('/login');
      return;
    }
    setErrors(Object.fromEntries(result.fields.map((field) => [field, messageFor(field)])));
    setFormError(result.error);
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      {formError && <Alert tone="danger" role="alert" title={tErrors(formError)} />}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-lg font-semibold text-text">{t('accountSection')}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('firstName')} name="firstName" autoComplete="given-name" required error={errors.firstName} />
          <Field label={t('lastName')} name="lastName" autoComplete="family-name" required error={errors.lastName} />
        </div>
        <Field label={t('email')} name="email" type="email" autoComplete="email" required error={errors.email} />
        <Field
          label={t('password')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint={t('passwordHint', { min: PASSWORD_MIN_LENGTH })}
          error={errors.password}
        />
        <Field
          label={t('confirmPassword')}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 text-lg font-semibold text-text">{t('approvalSection')}</legend>
        <p className="text-sm text-text-muted">{t('approvalIntro')}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={approvalId} className="flex items-start gap-2 text-base text-text">
            <input
              id={approvalId}
              type="checkbox"
              name="bishopApproved"
              required
              aria-invalid={errors.bishopApproved ? true : undefined}
              aria-describedby={errors.bishopApproved ? `${approvalId}-error` : undefined}
              className="mt-1 size-4 accent-primary"
            />
            {t('bishopApproved')}
          </label>
          {errors.bishopApproved && (
            <p id={`${approvalId}-error`} className="pl-6 text-sm text-danger-strong">
              {errors.bishopApproved}
            </p>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('bishopApprovedBy')} name="bishopApprovedBy" required error={errors.bishopApprovedBy} />
          <Field
            label={t('bishopApprovedOn')}
            name="bishopApprovedOn"
            type="date"
            max={today}
            required
            error={errors.bishopApprovedOn}
          />
        </div>
      </fieldset>

      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
