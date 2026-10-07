'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ApiResult } from '@/lib/api-client';
import {
  GENDERS,
  MIN_AGE_ORDINANCES,
  ORDINANCES,
  calculateAge,
  normalizeIdNumber,
  participantPrices,
  quotaKey,
  type Gender,
  type Ordinance,
} from '@/lib/temple-trips/constants';
import type { PublicTripView } from '@/server/temple-trips/registrations';

type Grecaptcha = { ready: (cb: () => void) => void; execute: (siteKey: string, options: { action: string }) => Promise<string> };
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

type Person = {
  idNumber: string;
  birthDate: string;
  fullName: string;
  phone: string;
  email: string;
  gender: '' | Gender;
  wantsTransport: boolean;
  needsLodging: boolean;
  wantsBreakfast: boolean;
  wantsLunch: boolean;
  ordinances: Ordinance[];
};

function emptyPerson(): Person {
  return {
    idNumber: '',
    birthDate: '',
    fullName: '',
    phone: '',
    email: '',
    gender: '',
    wantsTransport: false,
    needsLodging: false,
    wantsBreakfast: false,
    wantsLunch: false,
    ordinances: [],
  };
}

const ERROR_KEYS = [
  'registration_closed',
  'age_ordinance',
  'duplicate_in_submission',
  'duplicate_existing',
  'quota_exceeded',
  'recaptcha_failed',
] as const;

export function PublicRegistration({
  unitName,
  logoDataUrl,
  retentionMonths,
  recaptchaSiteKey,
  trip,
}: {
  unitName: string;
  logoDataUrl: string | null;
  retentionMonths: number;
  recaptchaSiteKey: string | null;
  trip: PublicTripView | null;
}) {
  const t = useTranslations('templeTrips.public');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (!recaptchaSiteKey || document.getElementById('recaptcha-script')) return;
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    document.head.appendChild(script);
  }, [recaptchaSiteKey]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo del data-URL de la unidad, no optimizable por next/image
          <img src={logoDataUrl} alt={unitName} className="h-14 w-auto" />
        ) : (
          <span className="text-lg font-semibold text-text">{unitName}</span>
        )}
        <h1 className="text-2xl font-semibold text-text">{t('title')}</h1>
      </header>

      {!trip ? (
        <Alert tone="info" role="status" title={t('noActiveTrip')} />
      ) : !trip.registrationOpen ? (
        <Alert tone="info" role="status" title={t('closed')} />
      ) : (
        <RegistrationForm trip={trip} recaptchaSiteKey={recaptchaSiteKey} unitName={unitName} retentionMonths={retentionMonths} />
      )}

      <footer className="flex flex-col items-center gap-2 border-t border-border pt-4 text-center text-sm text-text-muted">
        <p>{t('notOfficial')}</p>
        <LocaleSwitcher />
        <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline">
          {tCommon('privacyLink')}
        </Link>
      </footer>
    </div>
  );
}

function RegistrationForm({
  trip,
  recaptchaSiteKey,
  unitName,
  retentionMonths,
}: {
  trip: PublicTripView;
  recaptchaSiteKey: string | null;
  unitName: string;
  retentionMonths: number;
}) {
  const t = useTranslations('templeTrips.public');
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const tGenders = useTranslations('templeTrips.quotas.genders');
  const locale = useLocale();
  const formatMoney = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
  const [people, setPeople] = useState<Person[]>([emptyPerson()]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const dateLabel = trip.dateConfirmed
    ? new Date(`${trip.date}T00:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : t('dateToConfirm');
  const deadlineLabel = new Date(`${trip.registrationDeadline}T00:00:00`).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  function update(index: number, patch: Partial<Person>) {
    setPeople((previous) =>
      previous.map((person, current) => {
        if (current !== index) return person;
        const next = { ...person, ...patch };
        // Desmarca las ordenanzas que dejen de calificar al cambiar género o fecha.
        next.ordinances = next.ordinances.filter((ordinance) => ordinanceEnabled(next, ordinance));
        return next;
      }),
    );
  }

  function ordinanceEnabled(person: Person, ordinance: Ordinance): boolean {
    if (!person.gender || !person.birthDate) return false;
    if (calculateAge(person.birthDate, trip.date) < MIN_AGE_ORDINANCES) return false;
    return trip.remainingQuotas[quotaKey(ordinance, person.gender)] > 0;
  }

  function costOf(person: Person): number {
    return participantPrices(trip, {
      wantsTransport: trip.includesTransport && person.wantsTransport,
      wantsBreakfast: trip.includesBreakfast && person.wantsBreakfast,
      wantsLunch: trip.includesLunch && person.wantsLunch,
    }).totalCost;
  }

  const total = useMemo(() => people.reduce((sum, person) => sum + costOf(person), 0), [people]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = people.every(
    (person) => person.idNumber.trim() && person.birthDate && person.fullName.trim() && person.phone.trim() && person.email.trim() && person.gender,
  );

  function addPerson() {
    setPeople((previous) => [...previous, { ...emptyPerson(), phone: previous[0]!.phone, email: previous[0]!.email }]);
  }

  function removePerson(index: number) {
    setPeople((previous) => previous.filter((_, current) => current !== index));
  }

  function messageFor(result: Extract<ApiResult<unknown>, { ok: false }>) {
    const code = result.issues[0]?.code;
    const key = ERROR_KEYS.find((candidate) => candidate === code);
    if (key) return t(`errors.${key}`, { age: MIN_AGE_ORDINANCES });
    if (result.error === 'not_found') return t('noActiveTrip');
    return tErrors(result.error);
  }

  async function recaptchaToken(): Promise<string | undefined> {
    if (!recaptchaSiteKey || !window.grecaptcha) return undefined;
    try {
      return await window.grecaptcha.execute(recaptchaSiteKey, { action: 'temple_trip_register' });
    } catch {
      return undefined;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent || !complete) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      consent: true as const,
      recaptchaToken: await recaptchaToken(),
      participants: people.map((person) => ({
        idNumber: person.idNumber.trim(),
        birthDate: person.birthDate,
        fullName: person.fullName.trim(),
        phone: person.phone.trim(),
        email: person.email.trim(),
        gender: person.gender,
        wantsTransport: person.wantsTransport,
        needsLodging: person.needsLodging,
        wantsBreakfast: person.wantsBreakfast,
        wantsLunch: person.wantsLunch,
        ordinances: person.ordinances,
      })),
    };
    const result = await postJson<{ ok: true }>('/api/public/temple-trip', payload);
    setSubmitting(false);
    if (!result.ok) {
      setError(messageFor(result));
      liveRef.current?.focus();
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="success" role="status" title={t('success')} />
        <p className="text-sm text-text-muted">{t('contributionNote')}</p>
        {trip.donationCategoryName && <p className="text-sm font-medium text-text">{t('contributionCategory', { category: trip.donationCategoryName })}</p>}
        {trip.donationInstructions && <p className="text-sm text-text-muted">{trip.donationInstructions}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4 text-sm text-text-muted">
        <p className="text-base font-medium text-text">{t('tripOn', { date: dateLabel })}</p>
        <p>{t('deadline', { date: deadlineLabel })}</p>
      </section>

      <p ref={liveRef} tabIndex={-1} aria-live="assertive" className="min-h-0 outline-none">
        {error && <Alert tone="danger" role="alert" title={error} />}
      </p>

      {people.map((person, index) => (
        <fieldset key={index} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-medium text-text-muted">
            <span>{t('participant', { n: index + 1 })}</span>
            {people.length > 1 && (
              <Button type="button" variant="link" onClick={() => removePerson(index)}>
                {t('removeParticipant')}
              </Button>
            )}
          </legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('fields.idNumber')}
              value={person.idNumber}
              onChange={(event) => update(index, { idNumber: normalizeIdNumber(event.target.value) })}
              required
            />
            <Field type="date" label={t('fields.birthDate')} value={person.birthDate} onChange={(event) => update(index, { birthDate: event.target.value })} required />
            <Field label={t('fields.fullName')} value={person.fullName} onChange={(event) => update(index, { fullName: event.target.value })} required />
            <Field type="tel" label={t('fields.phone')} value={person.phone} onChange={(event) => update(index, { phone: event.target.value })} required />
            <Field type="email" label={t('fields.email')} value={person.email} onChange={(event) => update(index, { email: event.target.value })} required />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('fields.gender')}</span>
              <select
                aria-label={t('fields.gender')}
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                value={person.gender}
                onChange={(event) => update(index, { gender: event.target.value as Gender })}
                required
              >
                <option value="" disabled>
                  {t('fields.gender')}
                </option>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {tGenders(gender)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Services trip={trip} person={person} onChange={(patch) => update(index, patch)} />
          <Ordinances trip={trip} person={person} enabled={(ordinance) => ordinanceEnabled(person, ordinance)} onChange={(patch) => update(index, patch)} />

          <p className="text-sm font-medium text-text">{t('participantCost', { cost: formatMoney(costOf(person)) })}</p>
        </fieldset>
      ))}

      <Button type="button" variant="secondary" className="self-start" disabled={!complete} onClick={addPerson}>
        {t('addParticipant')}
      </Button>

      <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
        <p className="text-base font-semibold text-text">{t('estimatedTotal', { cost: formatMoney(total) })}</p>
        <p className="text-sm text-text-muted">{t('contributionNote')}</p>
        {trip.donationCategoryName && <p className="text-sm font-medium text-text">{t('contributionCategory', { category: trip.donationCategoryName })}</p>}
        {trip.donationInstructions && <p className="text-sm text-text-muted">{trip.donationInstructions}</p>}
        <p className="text-sm text-text-muted">
          {t('dataNotice', { unit: unitName, months: retentionMonths })}{' '}
          <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline">
            {tCommon('privacyLink')}
          </Link>
        </p>
        <label className="flex items-start gap-2 text-sm text-text">
          <input type="checkbox" className="mt-1 size-4 accent-primary" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>{t('consent')}</span>
        </label>
      </section>

      <Button type="submit" className="self-start" disabled={submitting || !consent || !complete}>
        {t('submit')}
      </Button>
    </form>
  );
}

function Services({ trip, person, onChange }: { trip: PublicTripView; person: Person; onChange: (patch: Partial<Person>) => void }) {
  const t = useTranslations('templeTrips.public');
  const items: { include: boolean; key: keyof Person; label: string; quota?: number }[] = [
    { include: trip.includesTransport, key: 'wantsTransport', label: t('wants.transport'), quota: trip.remainingQuotas.transport },
    { include: trip.includesLodging, key: 'needsLodging', label: t('wants.lodging'), quota: trip.remainingQuotas.lodging },
    { include: trip.includesBreakfast, key: 'wantsBreakfast', label: t('wants.breakfast') },
    { include: trip.includesLunch, key: 'wantsLunch', label: t('wants.lunch') },
  ];
  const shown = items.filter((item) => item.include);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {shown.map((item) => {
        const soldOut = item.quota !== undefined && item.quota <= 0;
        return (
          <label key={item.key} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={Boolean(person[item.key])}
              disabled={soldOut}
              onChange={(event) => onChange({ [item.key]: event.target.checked } as Partial<Person>)}
            />
            <span>{item.label}</span>
            {item.quota !== undefined && (
              <span className="text-xs text-text-muted">{soldOut ? t('noQuota') : t('available', { n: item.quota })}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function Ordinances({
  trip,
  person,
  enabled,
  onChange,
}: {
  trip: PublicTripView;
  person: Person;
  enabled: (ordinance: Ordinance) => boolean;
  onChange: (patch: Partial<Person>) => void;
}) {
  const t = useTranslations('templeTrips.public');
  const tOrdinances = useTranslations('templeTrips.quotas.ordinances');

  function reason(ordinance: Ordinance): string | null {
    if (!person.gender) return t('ordinanceDisabled.needsGender');
    if (!person.birthDate) return t('ordinanceDisabled.needsBirthDate');
    if (calculateAge(person.birthDate, trip.date) < MIN_AGE_ORDINANCES) return t('ordinanceDisabled.tooYoung', { age: MIN_AGE_ORDINANCES });
    if (person.gender && trip.remainingQuotas[quotaKey(ordinance, person.gender)] <= 0) return t('ordinanceDisabled.noQuota');
    return null;
  }

  function toggle(ordinance: Ordinance, checked: boolean) {
    const ordinances = checked ? [...person.ordinances, ordinance] : person.ordinances.filter((item) => item !== ordinance);
    onChange({ ordinances });
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium text-text-muted">{t('ordinancesLegend')}</legend>
      {ORDINANCES.map((ordinance) => {
        const disabledReason = reason(ordinance);
        return (
          <label key={ordinance} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={person.ordinances.includes(ordinance)}
              disabled={!enabled(ordinance)}
              onChange={(event) => toggle(ordinance, event.target.checked)}
            />
            <span>{tOrdinances(ordinance)}</span>
            {disabledReason && <span className="text-xs text-text-muted">{disabledReason}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
