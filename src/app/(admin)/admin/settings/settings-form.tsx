'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { LOCALE_NAMES, LOCALES } from '@/i18n/config';
import { patchJson, type ErrorCode } from '@/lib/api-client';
import { useConfig, useSetConfig } from '@/lib/config/use-config';
import { configSchema, type PublicConfig } from '@/lib/validation/config';
import { Card } from './card';
import { LogoCard } from './logo-card';
import { SmtpCard } from './smtp-card';
import { TelegramCard } from './telegram-card';

type Values = {
  unitName: string;
  allowRegistration: boolean;
  timezone: string;
  defaultLocale: string;
  contact: string;
  controllerName: string;
  controllerEmail: string;
  controllerPhone: string;
  controllerAddress: string;
  controllerCity: string;
  controllerWebsite: string;
  retentionMonths: string;
  policyVersion: string;
  defaultNationality: string;
};

type Section = 'general' | 'controller';

const SECTION_FIELDS: Record<Section, (keyof Values)[]> = {
  general: ['unitName', 'allowRegistration', 'timezone', 'defaultLocale', 'contact', 'defaultNationality'],
  controller: ['controllerName', 'controllerEmail', 'controllerPhone', 'controllerAddress', 'controllerCity', 'controllerWebsite', 'retentionMonths', 'policyVersion'],
};

const PATH_TO_FIELD: Record<string, keyof Values> = {
  unitName: 'unitName',
  allowRegistration: 'allowRegistration',
  timezone: 'timezone',
  defaultLocale: 'defaultLocale',
  contact: 'contact',
  'controller.name': 'controllerName',
  'controller.email': 'controllerEmail',
  'controller.phone': 'controllerPhone',
  'controller.address': 'controllerAddress',
  'controller.city': 'controllerCity',
  'controller.website': 'controllerWebsite',
  retentionMonths: 'retentionMonths',
  policyVersion: 'policyVersion',
  defaultNationality: 'defaultNationality',
};

function toValues(config: PublicConfig): Values {
  return {
    unitName: config.unitName,
    allowRegistration: config.allowRegistration,
    timezone: config.timezone,
    defaultLocale: config.defaultLocale,
    contact: config.contact ?? '',
    controllerName: config.controller.name ?? '',
    controllerEmail: config.controller.email ?? '',
    controllerPhone: config.controller.phone ?? '',
    controllerAddress: config.controller.address ?? '',
    controllerCity: config.controller.city ?? '',
    controllerWebsite: config.controller.website ?? '',
    retentionMonths: String(config.retentionMonths),
    policyVersion: config.policyVersion,
    defaultNationality: config.defaultNationality,
  };
}

function toInput(values: Values) {
  return {
    unitName: values.unitName,
    allowRegistration: values.allowRegistration,
    timezone: values.timezone,
    defaultLocale: values.defaultLocale,
    contact: values.contact,
    controller: {
      name: values.controllerName,
      email: values.controllerEmail,
      phone: values.controllerPhone,
      address: values.controllerAddress,
      city: values.controllerCity,
      website: values.controllerWebsite,
    },
    retentionMonths: /^\d+$/.test(values.retentionMonths.trim()) ? Number(values.retentionMonths) : Number.NaN,
    policyVersion: values.policyVersion,
    defaultNationality: values.defaultNationality,
  };
}

function merge(saved: Values, draft: Values, section: Section): Values {
  const next = { ...saved };
  for (const field of SECTION_FIELDS[section]) (next as Record<string, unknown>)[field] = draft[field];
  return next;
}

export function SettingsForm({ timeZones, currentEmail }: { timeZones: string[]; currentEmail: string }) {
  const { data: config } = useConfig();
  if (!config) return null;
  return (
    <>
      <SettingsCards config={config} timeZones={timeZones} />
      <SmtpCard currentEmail={currentEmail} />
      <TelegramCard />
    </>
  );
}

function SettingsCards({ config, timeZones }: { config: PublicConfig; timeZones: string[] }) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const setConfig = useSetConfig();
  const saved = toValues(config);
  const [draft, setDraft] = useState<Values>(saved);
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [status, setStatus] = useState<{ section: Section; ok: boolean; error?: ErrorCode } | null>(null);
  const [saving, setSaving] = useState<Section | null>(null);
  const zones = timeZones.includes(draft.timezone) ? timeZones : [draft.timezone, ...timeZones];

  function messageFor(field: keyof Values, code?: string) {
    if (code === 'official_name') return t('errors.officialName');
    if (field === 'unitName') return t('errors.unitName');
    if (field === 'contact') return t('errors.contact');
    if (field === 'controllerEmail') return tCommon('invalidEmail');
    if (field === 'controllerWebsite') return t('errors.website');
    if (field === 'controllerPhone') return t('errors.phone');
    if (field === 'timezone') return t('errors.timezone');
    if (field === 'retentionMonths') return t('errors.retentionMonths');
    return tCommon('required');
  }

  function errorsFor(values: Values, section: Section) {
    const found: Partial<Record<keyof Values, string>> = {};
    const parsed = configSchema.safeParse(toInput(merge(saved, values, section)));
    if (parsed.success) return found;
    for (const issue of parsed.error.issues) {
      const field = PATH_TO_FIELD[issue.path.map(String).join('.')];
      if (field && SECTION_FIELDS[section].includes(field)) {
        found[field] ??= messageFor(field, issue.code === 'custom' ? issue.message : undefined);
      }
    }
    return found;
  }

  const liveErrors = { ...errorsFor(draft, 'general'), ...errorsFor(draft, 'controller') };
  const visibleError = (field: keyof Values) => serverErrors[field] ?? (touched[field] ? liveErrors[field] : undefined);
  const isDirty = (section: Section) => SECTION_FIELDS[section].some((field) => draft[field] !== saved[field]);
  const canSave = (section: Section) =>
    saving === null && isDirty(section) && Object.keys(errorsFor(draft, section)).length === 0;

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
    setStatus(null);
  }

  async function save(section: Section, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave(section)) return;
    setSaving(section);
    setStatus(null);
    const result = await patchJson<PublicConfig>('/api/config', configSchema.parse(toInput(merge(saved, draft, section))));
    setSaving(null);
    if (result.ok) {
      await setConfig(result.data);
      const next = toValues(result.data);
      setDraft((current) => merge(next, current, section === 'general' ? 'controller' : 'general'));
      setTouched({});
      setServerErrors({});
      setStatus({ section, ok: true });
      router.refresh();
      return;
    }
    const codes = Object.fromEntries(result.issues.map((issue) => [issue.field, issue.code]));
    const found: Partial<Record<keyof Values, string>> = {};
    for (const path of result.fields) {
      const field = PATH_TO_FIELD[path];
      if (field) found[field] = messageFor(field, codes[path]);
    }
    setServerErrors(found);
    setStatus({ section, ok: false, error: result.error });
  }

  function feedback(section: Section) {
    if (status?.section !== section) return null;
    return status.ok ? (
      <Alert tone="success" role="status" title={t('saved')} />
    ) : (
      <Alert tone="danger" role="alert" title={tErrors(status.error ?? 'unknown')} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title={t('general.title')}>
        <form noValidate onSubmit={(event) => save('general', event)} className="flex flex-col gap-5">
          <Field
            label={t('general.unitName')}
            name="unitName"
            value={draft.unitName}
            onChange={(event) => update('unitName', event.target.value)}
            error={visibleError('unitName')}
            required
          />
          <label className="flex items-start gap-2 text-base text-text">
            <input
              type="checkbox"
              name="allowRegistration"
              checked={draft.allowRegistration}
              onChange={(event) => update('allowRegistration', event.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            {t('general.allowRegistration')}
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label={t('general.timezone')}
              name="timezone"
              value={draft.timezone}
              onChange={(value) => update('timezone', value)}
              error={visibleError('timezone')}
              options={zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
            />
            <Select
              label={t('general.defaultLocale')}
              name="defaultLocale"
              value={draft.defaultLocale}
              onChange={(value) => update('defaultLocale', value)}
              options={LOCALES.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] }))}
            />
          </div>
          <Field
            label={t('general.contact')}
            name="contact"
            hint={t('general.contactHint')}
            value={draft.contact}
            onChange={(event) => update('contact', event.target.value)}
            error={visibleError('contact')}
            required
          />
          <Field
            label={t('general.defaultNationality')}
            name="defaultNationality"
            hint={t('general.defaultNationalityHint')}
            value={draft.defaultNationality}
            onChange={(event) => update('defaultNationality', event.target.value)}
            error={visibleError('defaultNationality')}
          />
          {feedback('general')}
          <Button type="submit" disabled={!canSave('general')} className="self-start">
            {saving === 'general' ? t('saving') : t('save')}
          </Button>
        </form>
      </Card>

      <LogoCard config={config} />

      <Card title={t('controller.title')} intro={t('controller.intro')}>
        <form noValidate onSubmit={(event) => save('controller', event)} className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t('controller.name')}
              name="controllerName"
              value={draft.controllerName}
              onChange={(event) => update('controllerName', event.target.value)}
              error={visibleError('controllerName')}
            />
            <Field
              label={t('controller.email')}
              name="controllerEmail"
              type="email"
              value={draft.controllerEmail}
              onChange={(event) => update('controllerEmail', event.target.value)}
              error={visibleError('controllerEmail')}
            />
            <Field
              label={t('controller.phone')}
              name="controllerPhone"
              type="tel"
              hint={t('controller.phoneHint')}
              value={draft.controllerPhone}
              onChange={(event) => update('controllerPhone', event.target.value)}
              error={visibleError('controllerPhone')}
            />
            <Field
              label={t('controller.address')}
              name="controllerAddress"
              hint={t('controller.addressHint')}
              value={draft.controllerAddress}
              onChange={(event) => update('controllerAddress', event.target.value)}
              error={visibleError('controllerAddress')}
            />
            <Field
              label={t('controller.city')}
              name="controllerCity"
              value={draft.controllerCity}
              onChange={(event) => update('controllerCity', event.target.value)}
              error={visibleError('controllerCity')}
            />
            <Field
              label={t('controller.website')}
              name="controllerWebsite"
              type="url"
              placeholder={t('controller.websitePlaceholder')}
              value={draft.controllerWebsite}
              onChange={(event) => update('controllerWebsite', event.target.value)}
              error={visibleError('controllerWebsite')}
            />
            <Field
              label={t('controller.retentionMonths')}
              name="retentionMonths"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={draft.retentionMonths}
              onChange={(event) => update('retentionMonths', event.target.value)}
              error={visibleError('retentionMonths')}
              required
            />
            <Field
              label={t('controller.policyVersion')}
              name="policyVersion"
              hint={t('controller.policyVersionHint')}
              value={draft.policyVersion}
              onChange={(event) => update('policyVersion', event.target.value)}
              error={visibleError('policyVersion')}
              required
            />
          </div>
          {feedback('controller')}
          <Button type="submit" disabled={!canSave('controller')} className="self-start">
            {saving === 'controller' ? t('saving') : t('save')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-muted">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
