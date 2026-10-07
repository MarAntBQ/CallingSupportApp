'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { isLocale, LOCALE_NAMES, LOCALES } from '@/i18n/config';
import { patchJson, postJson, type ErrorCode } from '@/lib/api-client';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';
import { changePasswordSchema, profileSchema } from '@/lib/validation/profile';
import { Card } from '../settings/card';

type Data = { firstName: string; lastName: string; phone: string };
type DataField = keyof Data;
type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';
type Status = { ok: true } | { ok: false; error: ErrorCode } | null;

export function ProfileForm({ initial, locale }: { initial: Data; locale: string }) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const localeId = useId();
  const [saved, setSaved] = useState(initial);
  const [data, setData] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<DataField, boolean>>>({});
  const [dataStatus, setDataStatus] = useState<Status>(null);
  const [savingData, setSavingData] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [localeFailed, setLocaleFailed] = useState(false);
  const [refreshing, startTransition] = useTransition();

  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordTouched, setPasswordTouched] = useState<Partial<Record<PasswordField, boolean>>>({});
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  function dataErrors(values: Data) {
    const found: Partial<Record<DataField, string>> = {};
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '') as DataField;
        if (field === 'phone') found.phone ??= t('errors.phone');
        else if (field === 'firstName' || field === 'lastName') found[field] ??= t('errors.name');
      }
    }
    return found;
  }

  function passwordErrors(values: typeof password) {
    const found: Partial<Record<PasswordField, string>> = {};
    const parsed = changePasswordSchema.safeParse({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '') as PasswordField;
        if (field === 'newPassword') found.newPassword ??= t('errors.passwordTooShort', { min: PASSWORD_MIN_LENGTH });
        else if (field === 'currentPassword') found.currentPassword ??= tCommon('required');
      }
    }
    if (values.confirmPassword !== values.newPassword) found.confirmPassword = t('errors.passwordMismatch');
    return found;
  }

  const liveData = dataErrors(data);
  const changed = (Object.keys(data) as DataField[]).filter((field) => data[field].trim() !== saved[field].trim());
  const canSaveData = !savingData && changed.length > 0 && Object.keys(liveData).length === 0;

  const livePassword = passwordErrors(password);
  const canSavePassword = !savingPassword && Object.keys(livePassword).length === 0;
  const passwordError = (field: PasswordField) =>
    (field === 'currentPassword' ? passwordServerError : null) ?? (passwordTouched[field] ? livePassword[field] : undefined);

  async function saveData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveData) return;
    setSavingData(true);
    setDataStatus(null);
    const body = Object.fromEntries(changed.map((field) => [field, data[field]]));
    const result = await patchJson('/api/auth/profile', body);
    setSavingData(false);
    if (!result.ok) {
      setDataStatus({ ok: false, error: result.error });
      return;
    }
    const next = { firstName: data.firstName.trim(), lastName: data.lastName.trim(), phone: data.phone.trim() };
    setSaved(next);
    setData(next);
    setTouched({});
    setDataStatus({ ok: true });
    startTransition(() => router.refresh());
  }

  async function changeLocale(next: string) {
    if (!isLocale(next) || next === selectedLocale) return;
    const previous = selectedLocale;
    setSelectedLocale(next);
    setLocaleFailed(false);
    const result = await postJson('/api/locale', { locale: next });
    if (!result.ok) {
      setSelectedLocale(previous);
      setLocaleFailed(true);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordTouched({ currentPassword: true, newPassword: true, confirmPassword: true });
    if (!canSavePassword) return;
    setSavingPassword(true);
    setPasswordStatus(null);
    setPasswordServerError(null);
    const result = await postJson('/api/auth/change-password', {
      currentPassword: password.currentPassword,
      newPassword: password.newPassword,
    });
    setSavingPassword(false);
    if (result.ok) {
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordTouched({});
      setPasswordStatus({ ok: true });
      return;
    }
    if (result.issues.some((issue) => issue.field === 'currentPassword' && issue.code === 'incorrect')) {
      setPasswordServerError(t('errors.currentPassword'));
      return;
    }
    setPasswordStatus({ ok: false, error: result.error });
  }

  function updateData(field: DataField, value: string) {
    setData((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setDataStatus(null);
  }

  function updatePassword(field: PasswordField, value: string) {
    setPassword((current) => ({ ...current, [field]: value }));
    setPasswordTouched((current) => ({ ...current, [field]: true }));
    if (field === 'currentPassword') setPasswordServerError(null);
    setPasswordStatus(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title={t('data.title')}>
        <form noValidate onSubmit={saveData} className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t('data.firstName')}
              name="firstName"
              autoComplete="given-name"
              value={data.firstName}
              onChange={(event) => updateData('firstName', event.target.value)}
              error={touched.firstName ? liveData.firstName : undefined}
              required
            />
            <Field
              label={t('data.lastName')}
              name="lastName"
              autoComplete="family-name"
              value={data.lastName}
              onChange={(event) => updateData('lastName', event.target.value)}
              error={touched.lastName ? liveData.lastName : undefined}
              required
            />
          </div>
          <Field
            label={t('data.phone')}
            name="phone"
            type="tel"
            autoComplete="tel"
            hint={t('data.phoneHint')}
            value={data.phone}
            onChange={(event) => updateData('phone', event.target.value)}
            error={touched.phone ? liveData.phone : undefined}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={localeId} className="text-sm font-medium text-text-muted">
              {t('data.locale')}
            </label>
            <select
              id={localeId}
              name="locale"
              value={selectedLocale}
              disabled={refreshing}
              onChange={(event) => void changeLocale(event.target.value)}
              className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary disabled:bg-surface-muted disabled:text-text-muted sm:w-64"
            >
              {LOCALES.map((option) => (
                <option key={option} value={option} lang={option}>
                  {LOCALE_NAMES[option]}
                </option>
              ))}
            </select>
            {localeFailed && (
              <p role="alert" className="text-sm text-danger-strong">
                {tCommon('localeSwitcher.error')}
              </p>
            )}
          </div>
          {dataStatus &&
            (dataStatus.ok ? (
              <Alert tone="success" role="status" title={t('data.saved')} />
            ) : (
              <Alert tone="danger" role="alert" title={tErrors(dataStatus.error)} />
            ))}
          <Button type="submit" disabled={!canSaveData} className="self-start">
            {savingData ? t('saving') : t('save')}
          </Button>
        </form>
      </Card>

      <Card title={t('password.title')} intro={t('password.intro')}>
        <form noValidate onSubmit={savePassword} className="flex flex-col gap-5">
          <Field
            label={t('password.current')}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={password.currentPassword}
            onChange={(event) => updatePassword('currentPassword', event.target.value)}
            error={passwordError('currentPassword') ?? undefined}
            required
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t('password.new')}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              hint={t('password.newHint', { min: PASSWORD_MIN_LENGTH })}
              value={password.newPassword}
              onChange={(event) => updatePassword('newPassword', event.target.value)}
              error={passwordError('newPassword')}
              required
            />
            <Field
              label={t('password.confirm')}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={password.confirmPassword}
              onChange={(event) => updatePassword('confirmPassword', event.target.value)}
              error={passwordError('confirmPassword')}
              required
            />
          </div>
          {passwordStatus &&
            (passwordStatus.ok ? (
              <Alert tone="success" role="status" title={t('password.saved')}>
                {t('password.savedBody')}
              </Alert>
            ) : (
              <Alert tone="danger" role="alert" title={tErrors(passwordStatus.error)} />
            ))}
          <Button type="submit" disabled={!canSavePassword || Boolean(passwordServerError)} className="self-start">
            {savingPassword ? t('password.saving') : t('password.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
