'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ApiResult } from '@/lib/api-client';
import { GENDERS, type Gender } from '@/lib/camps/constants';
import { formatMoney } from '@/lib/format';
import { isLocale } from '@/i18n/config';
import { MEDICAL_RELEASE_FORM_URL } from '@/lib/camps/links';
import type { PublicCampView } from '@/lib/validation/camps';

type Grecaptcha = { ready: (cb: () => void) => void; execute: (siteKey: string, options: { action: string }) => Promise<string> };
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const LINK = 'font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline';
const SELECT =
  'w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary';
const ERROR_KEYS = ['registration_closed', 'recaptcha_failed', 'future_date'] as const;

type Youth = { fullName: string; birthDate: string; gender: '' | Gender; emergencyContactName: string; emergencyContactPhone: string };

const emptyYouth = (): Youth => ({ fullName: '', birthDate: '', gender: '', emergencyContactName: '', emergencyContactPhone: '' });

const youthComplete = (youth: Youth) =>
  youth.fullName.trim().length >= 3 &&
  Boolean(youth.birthDate) &&
  Boolean(youth.gender) &&
  youth.emergencyContactName.trim().length >= 3 &&
  youth.emergencyContactPhone.trim().length >= 6;

function formatDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function CampRegistration({
  camp,
  unitName,
  logoDataUrl,
  retentionMonths,
  recaptchaSiteKey,
}: {
  camp: PublicCampView;
  unitName: string;
  logoDataUrl: string | null;
  retentionMonths: number;
  recaptchaSiteKey: string | null;
}) {
  const t = useTranslations('camps.public');
  const locale = useLocale();

  useEffect(() => {
    if (!recaptchaSiteKey || !camp.registrationOpen || document.getElementById('recaptcha-script')) return;
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    document.head.appendChild(script);
  }, [recaptchaSiteKey, camp.registrationOpen]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo del data-URL de la unidad, no optimizable por next/image
          <img src={logoDataUrl} alt={unitName} className="h-14 w-auto" />
        ) : (
          <span className="text-lg font-semibold text-text">{unitName}</span>
        )}
        <h1 className="text-2xl font-semibold text-text">{camp.name}</h1>
        <p className="text-text-muted">
          {t('dates', { start: formatDate(camp.startDate, locale), end: formatDate(camp.endDate, locale) })} · {camp.location}
        </p>
        <p className="text-sm text-text-muted">{t('deadline', { date: formatDate(camp.registrationDeadline, locale) })}</p>
      </header>

      {camp.description && <p className="whitespace-pre-line text-text">{camp.description}</p>}

      <Alert tone="warning" title={t('medicalForm.title')}>
        {t.rich('medicalForm.body', {
          form: (chunks) => (
            <a href={MEDICAL_RELEASE_FORM_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              {chunks}
            </a>
          ),
        })}
      </Alert>

      {camp.packing.length > 0 && (
        <section className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold text-text">{t('packingTitle')}</h2>
          <ul className="list-disc pl-5 text-sm text-text">
            {camp.packing.map((item) => (
              <li key={item.id}>
                {item.name}
                {item.detail && <span className="text-text-muted"> — {item.detail}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {camp.registrationOpen ? (
        <RegistrationForm camp={camp} unitName={unitName} retentionMonths={retentionMonths} recaptchaSiteKey={recaptchaSiteKey} />
      ) : (
        <Alert tone="info" role="status" title={t('closed')} />
      )}

      <footer className="flex flex-col items-center gap-2 border-t border-border pt-4 text-center text-sm text-text-muted">
        <LocaleSwitcher />
      </footer>
    </div>
  );
}

function RegistrationForm({
  camp,
  unitName,
  retentionMonths,
  recaptchaSiteKey,
}: {
  camp: PublicCampView;
  unitName: string;
  retentionMonths: number;
  recaptchaSiteKey: string | null;
}) {
  const t = useTranslations('camps.public');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const activeLocale = useLocale();
  const consentId = useId();
  const [guardian, setGuardian] = useState({ name: '', phone: '', email: '' });
  const [youths, setYouths] = useState<Youth[]>([emptyYouth()]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const guardianComplete = guardian.name.trim().length >= 3 && guardian.phone.trim().length >= 6 && /.+@.+\..+/.test(guardian.email.trim());
  const complete = guardianComplete && youths.every(youthComplete);

  function update(index: number, patch: Partial<Youth>) {
    setYouths((previous) => previous.map((youth, i) => (i === index ? { ...youth, ...patch } : youth)));
  }

  async function recaptchaToken(): Promise<string | undefined> {
    if (!recaptchaSiteKey || !window.grecaptcha) return undefined;
    try {
      return await window.grecaptcha.execute(recaptchaSiteKey, { action: 'camp_register' });
    } catch {
      return undefined;
    }
  }

  function messageFor(result: Extract<ApiResult<unknown>, { ok: false }>) {
    const code = ERROR_KEYS.find((key) => result.issues.some((issue) => issue.code === key));
    if (code) return t(`errors.${code}`);
    if (result.error === 'invalid_input') return t('errors.fields');
    return tErrors(result.error);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent || !complete) return;
    setSubmitting(true);
    setError(null);
    const result = await postJson<{ count: number }>(`/api/public/camps/${camp.slug}/registrations`, {
      guardian: { name: guardian.name.trim(), phone: guardian.phone.trim(), email: guardian.email.trim() },
      participants: youths.map((youth) => ({
        fullName: youth.fullName.trim(),
        birthDate: youth.birthDate,
        gender: youth.gender,
        emergencyContactName: youth.emergencyContactName.trim(),
        emergencyContactPhone: youth.emergencyContactPhone.trim(),
      })),
      consent: true as const,
      recaptchaToken: await recaptchaToken(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(messageFor(result));
      return;
    }
    setDone(result.data.count);
  }

  if (done !== null) return <Alert tone="success" role="status" title={t('success', { n: done })} />;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      {error && <Alert tone="danger" role="alert" title={error} />}

      <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-base font-semibold text-text">{t('guardianLegend')}</legend>
        <Field label={t('fields.guardianName')} value={guardian.name} autoComplete="name" onChange={(event) => setGuardian({ ...guardian, name: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            type="tel"
            label={t('fields.guardianPhone')}
            value={guardian.phone}
            autoComplete="tel"
            inputMode="tel"
            onChange={(event) => setGuardian({ ...guardian, phone: event.target.value })}
          />
          <Field
            type="email"
            label={t('fields.guardianEmail')}
            hint={t('fields.guardianEmailHint')}
            value={guardian.email}
            autoComplete="email"
            onChange={(event) => setGuardian({ ...guardian, email: event.target.value })}
          />
        </div>
      </fieldset>

      {youths.map((youth, index) => (
        <fieldset key={index} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4" data-testid="camp-youth">
          <legend className="px-1 text-base font-semibold text-text">{t('youthLegend', { n: index + 1 })}</legend>
          <Field label={t('fields.fullName')} value={youth.fullName} onChange={(event) => update(index, { fullName: event.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field type="date" label={t('fields.birthDate')} value={youth.birthDate} onChange={(event) => update(index, { birthDate: event.target.value })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('fields.gender')}</span>
              <select aria-label={t('fields.gender')} className={SELECT} value={youth.gender} onChange={(event) => update(index, { gender: event.target.value as Gender })}>
                <option value="" disabled>
                  {t('fields.genderPlaceholder')}
                </option>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {t(`genders.${gender}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('fields.emergencyContactName')} value={youth.emergencyContactName} onChange={(event) => update(index, { emergencyContactName: event.target.value })} />
            <Field
              type="tel"
              inputMode="tel"
              label={t('fields.emergencyContactPhone')}
              value={youth.emergencyContactPhone}
              onChange={(event) => update(index, { emergencyContactPhone: event.target.value })}
            />
          </div>
          {youths.length > 1 && (
            <Button variant="link" className="self-start" onClick={() => setYouths((previous) => previous.filter((_, i) => i !== index))}>
              {t('removeYouth')}
            </Button>
          )}
        </fieldset>
      ))}

      {youths.length < 10 && (
        <Button variant="secondary" className="self-start" disabled={!youths.every(youthComplete)} onClick={() => setYouths((previous) => [...previous, emptyYouth()])}>
          {t('addYouth')}
        </Button>
      )}

      <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
        {camp.suggestedContributionYouth && (
          <div className="flex flex-col gap-1" data-testid="camp-contribution">
            <p className="text-base font-semibold text-text">{t('contribution', { amount: formatMoney(Number(camp.suggestedContributionYouth), isLocale(activeLocale) ? activeLocale : 'es') })}</p>
            <p className="text-sm text-text-muted">{t('contributionNote')}</p>
            {camp.donationCategoryName && <p className="text-sm font-medium text-text">{t('contributionCategory', { category: camp.donationCategoryName })}</p>}
            {camp.donationInstructions && <p className="text-sm whitespace-pre-line text-text-muted">{camp.donationInstructions}</p>}
          </div>
        )}
        <p className="text-sm text-text-muted">
          {t('dataNotice', { unit: unitName, months: retentionMonths })}{' '}
          <Link href="/privacy" className={LINK}>
            {tCommon('privacyLink')}
          </Link>
        </p>
        <label htmlFor={consentId} className="flex items-start gap-2 text-sm text-text">
          <input id={consentId} type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>{t('consent')}</span>
        </label>
      </section>

      <Button type="submit" className="self-start" disabled={submitting || !consent || !complete}>
        {t('submit')}
      </Button>
    </form>
  );
}
