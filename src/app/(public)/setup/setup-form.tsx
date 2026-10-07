'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ErrorCode } from '@/lib/api-client';
import { PRIVACY_POLICY_URL } from '@/lib/privacy';
import { PASSWORD_MIN_LENGTH, setupSchema, UNIT_TYPES, type UnitType } from '@/lib/validation/auth';

type FieldName =
  | 'unitType'
  | 'unitName'
  | 'contact'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'bishopApproved'
  | 'bishopApprovedBy'
  | 'bishopApprovedOn'
  | 'privacyConsent';

const FIELD_ORDER: FieldName[] = [
  'unitType',
  'unitName',
  'contact',
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
  'bishopApproved',
  'bishopApprovedBy',
  'bishopApprovedOn',
  'privacyConsent',
];

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function SetupForm() {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const unitTypeId = useId();
  const approvalId = useId();
  const consentId = useId();
  const [unitType, setUnitType] = useState<UnitType | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const leader = unitType ?? 'none';

  function messageFor(field: string, code?: string) {
    if (field === 'unitType') return t('unitTypeRequired');
    if (field === 'unitName') return code === 'official_name' ? t('officialName') : t('unitNameRequired');
    if (field === 'contact') return code === 'official_name' ? t('officialName') : t('contactRequired');
    if (field === 'email') return tCommon('invalidEmail');
    if (field === 'password') return t('passwordTooShort', { min: PASSWORD_MIN_LENGTH });
    if (field === 'bishopApproved') return t(`bishopApprovedRequired.${leader}`);
    if (field === 'privacyConsent') return t('privacy.consentRequired');
    if (field === 'bishopApprovedOn' && code === 'future_date') return t('futureDate');
    return tCommon('required');
  }

  function focusFirst(found: Partial<Record<FieldName, string>>) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const input = {
      unitType: value('unitType') || undefined,
      unitName: value('unitName'),
      contact: value('contact'),
      firstName: value('firstName'),
      lastName: value('lastName'),
      email: value('email'),
      password: value('password'),
      bishopApproved: form.get('bishopApproved') === 'on',
      bishopApprovedBy: value('bishopApprovedBy'),
      bishopApprovedOn: value('bishopApprovedOn'),
      privacyConsent: form.get('privacyConsent') === 'on',
      locale,
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
    if (!next.bishopApprovedOn && input.bishopApprovedOn > localToday()) next.bishopApprovedOn = t('futureDate');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) {
      focusFirst(next);
      return;
    }

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
    const codes = Object.fromEntries(result.issues.map((issue) => [issue.field, issue.code]));
    const serverErrors = Object.fromEntries(result.fields.map((field) => [field, messageFor(field, codes[field])]));
    setErrors(serverErrors);
    focusFirst(serverErrors);
    setFormError(result.error);
    setSubmitting(false);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      {formError && <Alert tone="danger" role="alert" title={tErrors(formError)} />}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-lg font-semibold text-text">{t('unitSection')}</legend>
        <div
          role="radiogroup"
          aria-labelledby={`${unitTypeId}-label`}
          aria-describedby={errors.unitType ? `${unitTypeId}-error` : undefined}
          aria-invalid={errors.unitType ? true : undefined}
          className="flex flex-col gap-1.5"
        >
          <p id={`${unitTypeId}-label`} className="text-sm font-medium text-text-muted">
            {t('unitType')}
          </p>
          <div className="flex flex-wrap gap-3">
            {UNIT_TYPES.map((type) => (
              <label
                key={type}
                className="flex min-w-32 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 py-2 text-base text-text has-checked:border-primary has-checked:text-primary-strong"
              >
                <input
                  type="radio"
                  name="unitType"
                  value={type}
                  checked={unitType === type}
                  onChange={() => setUnitType(type)}
                  className="size-4 accent-primary"
                />
                {t(type)}
              </label>
            ))}
          </div>
          {errors.unitType && (
            <p id={`${unitTypeId}-error`} className="text-sm text-danger-strong">
              {errors.unitType}
            </p>
          )}
        </div>
        <Field label={t('unitName')} name="unitName" required hint={t('unitNameHint')} error={errors.unitName} />
        <Field label={t('contact')} name="contact" required hint={t('contactHint')} error={errors.contact} />
      </fieldset>

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
        <legend className="mb-2 text-lg font-semibold text-text">{t(`approvalSection.${leader}`)}</legend>
        <p className="text-sm text-text-muted">{t(`approvalIntro.${leader}`)}</p>
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
            {t(`bishopApproved.${leader}`)}
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
            required
            error={errors.bishopApprovedOn}
          />
        </div>
      </fieldset>

      <section aria-labelledby={`${consentId}-title`} className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4">
        <h2 id={`${consentId}-title`} className="text-base font-semibold text-text">
          {t('privacy.title')}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
          <li>{t(`privacy.controller.${leader}`)}</li>
          <li>{t('privacy.what')}</li>
          <li>{t('privacy.who')}</li>
          <li>{t('privacy.howLong')}</li>
          <li>{t('privacy.where')}</li>
        </ul>
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline">
          {t('privacy.policyLink')}
        </a>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={consentId} className="flex items-start gap-2 text-base text-text">
            <input
              id={consentId}
              type="checkbox"
              name="privacyConsent"
              required
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
