'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, patchJson, type ApiResult } from '@/lib/api-client';
import { GENDERS, ORDINANCES, quotaKey, type QuotaKey } from '@/lib/temple-trips/constants';
import type { TempleTripListItem } from '@/lib/temple-trips/types';

const TRIPS_KEY = ['temple-trips'] as const;

async function fetchTrips(): Promise<TempleTripListItem[]> {
  const response = await fetch('/api/temple-trips', { cache: 'no-store' });
  if (!response.ok) throw new Error(`temple-trips ${response.status}`);
  return response.json();
}

type FormState = {
  templeName: string;
  date: string;
  registrationDeadline: string;
  dateConfirmed: boolean;
  active: boolean;
  scheduledWithTemple: boolean;
  inAssignedDistrict: boolean;
  includesTransport: boolean;
  includesLodging: boolean;
  includesBreakfast: boolean;
  includesLunch: boolean;
  quotaTransport: string;
  quotaLodging: string;
  costTransport: string;
  costBreakfast: string;
  costLunch: string;
} & Record<QuotaKey, string>;

function emptyForm(): FormState {
  const quotas = Object.fromEntries(
    ORDINANCES.flatMap((ordinance) => GENDERS.map((gender) => [quotaKey(ordinance, gender), '0'])),
  ) as Record<QuotaKey, string>;
  return {
    templeName: '',
    date: '',
    registrationDeadline: '',
    dateConfirmed: true,
    active: false,
    scheduledWithTemple: false,
    inAssignedDistrict: true,
    includesTransport: false,
    includesLodging: false,
    includesBreakfast: false,
    includesLunch: false,
    quotaTransport: '0',
    quotaLodging: '0',
    costTransport: '0',
    costBreakfast: '0',
    costLunch: '0',
    ...quotas,
  };
}

function toForm(trip: TempleTripListItem): FormState {
  const quotas = Object.fromEntries(
    ORDINANCES.flatMap((ordinance) =>
      GENDERS.map((gender) => {
        const key = quotaKey(ordinance, gender);
        return [key, String(trip[key])];
      }),
    ),
  ) as Record<QuotaKey, string>;
  return {
    templeName: trip.templeName,
    date: trip.date,
    registrationDeadline: trip.registrationDeadline,
    dateConfirmed: trip.dateConfirmed,
    active: trip.active,
    scheduledWithTemple: trip.scheduledWithTemple,
    inAssignedDistrict: trip.inAssignedDistrict,
    includesTransport: trip.includesTransport,
    includesLodging: trip.includesLodging,
    includesBreakfast: trip.includesBreakfast,
    includesLunch: trip.includesLunch,
    quotaTransport: String(trip.quotaTransport),
    quotaLodging: String(trip.quotaLodging),
    costTransport: trip.costTransport,
    costBreakfast: trip.costBreakfast,
    costLunch: trip.costLunch,
    ...quotas,
  };
}

function toPayload(form: FormState) {
  const quotas = Object.fromEntries(
    ORDINANCES.flatMap((ordinance) =>
      GENDERS.map((gender) => {
        const key = quotaKey(ordinance, gender);
        return [key, Number(form[key]) || 0];
      }),
    ),
  ) as Record<QuotaKey, number>;
  return {
    templeName: form.templeName.trim(),
    date: form.date,
    registrationDeadline: form.registrationDeadline,
    dateConfirmed: form.dateConfirmed,
    active: form.active,
    scheduledWithTemple: form.scheduledWithTemple,
    inAssignedDistrict: form.inAssignedDistrict,
    includesTransport: form.includesTransport,
    includesLodging: form.includesLodging,
    includesBreakfast: form.includesBreakfast,
    includesLunch: form.includesLunch,
    quotaTransport: Number(form.quotaTransport) || 0,
    quotaLodging: Number(form.quotaLodging) || 0,
    costTransport: Number(form.costTransport) || 0,
    costBreakfast: Number(form.costBreakfast) || 0,
    costLunch: Number(form.costLunch) || 0,
    ...quotas,
  };
}

export function TempleTripsAdmin({
  initialTrips,
  canCreate,
  canUpdate,
}: {
  initialTrips: TempleTripListItem[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const t = useTranslations('templeTrips');
  const { data: trips = initialTrips } = useQuery({ queryKey: TRIPS_KEY, queryFn: fetchTrips, initialData: initialTrips });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ trip: TempleTripListItem | null } | null>(null);

  const selected = useMemo(() => {
    if (trips.length === 0) return null;
    return trips.find((trip) => trip.id === selectedId) ?? trips.find((trip) => trip.active) ?? trips[0]!;
  }, [trips, selectedId]);

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-muted">{t('intro')}</p>
        </div>
        {canCreate && <Button onClick={() => setEditing({ trip: null })}>{t('newTrip')}</Button>}
      </div>

      {trips.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              selected={selected?.id === trip.id}
              canUpdate={canUpdate}
              onSelect={() => setSelectedId(trip.id)}
              onEdit={() => setEditing({ trip })}
            />
          ))}
        </ul>
      )}

      {selected && <TripTabs />}

      {editing && (
        <TripModal
          trip={editing.trip}
          onClose={() => setEditing(null)}
          onSaved={(savedId) => {
            setEditing(null);
            setSelectedId(savedId);
          }}
        />
      )}
    </section>
  );
}

function TripCard({
  trip,
  selected,
  canUpdate,
  onSelect,
  onEdit,
}: {
  trip: TempleTripListItem;
  selected: boolean;
  canUpdate: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations('templeTrips');
  const locale = useLocale();
  const dateLabel = trip.dateConfirmed
    ? new Date(`${trip.date}T00:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : t('unconfirmedDate');

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-col gap-2 rounded-md border bg-surface p-4 text-left shadow-sm ${selected ? 'border-primary' : 'border-border'}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-text">{trip.templeName}</span>
          {trip.active && (
            <span className="rounded-full bg-success-surface px-2 py-0.5 text-xs font-semibold text-success-strong">{t('badges.active')}</span>
          )}
          {!trip.dateConfirmed && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-text-muted">{t('badges.unconfirmed')}</span>
          )}
        </div>
        <span className="text-sm text-text-muted">{dateLabel}</span>
        <span className="flex flex-wrap gap-4 text-sm text-text-muted">
          <span>{t('counts.registered', { n: trip.registeredCount })}</span>
          <span>{t('counts.approved', { n: trip.approvedCount })}</span>
          <span>{t('counts.pending', { n: trip.pendingCount })}</span>
        </span>
        {canUpdate && (
          <span className="pt-1">
            <Button
              variant="link"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              {t('editTrip')}
            </Button>
          </span>
        )}
      </button>
    </li>
  );
}

function TripTabs() {
  const t = useTranslations('templeTrips');
  const tabs = ['participants', 'rooms', 'reports'] as const;
  const [active, setActive] = useState<(typeof tabs)[number]>('participants');
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => (
          <Button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            variant={active === tab ? 'secondary' : 'link'}
            onClick={() => setActive(tab)}
          >
            {t(`tabs.${tab}`)}
          </Button>
        ))}
      </div>
      <p className="text-sm text-text-muted">{t('tabs.soon')}</p>
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-text">
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function TripModal({
  trip,
  onClose,
  onSaved,
}: {
  trip: TempleTripListItem | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const t = useTranslations('templeTrips');
  const tErrors = useTranslations('errors');
  const queryClient = useQueryClient();
  const titleId = useId();
  const [form, setForm] = useState<FormState>(() => (trip ? toForm(trip) : emptyForm()));
  const [confirmedOutside, setConfirmedOutside] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  const needsDistrictConfirm = !form.inAssignedDistrict && !confirmedOutside;

  function messageFor(result: Extract<ApiResult<unknown>, { ok: false }>) {
    const codes = new Set(result.issues.map((issue) => issue.code));
    if (codes.has('schedule_with_temple_required')) return t('errors.schedule_with_temple_required');
    if (codes.has('deadline_after_date')) return t('errors.deadline_after_date');
    if (result.error === 'invalid_input') return t('errors.deadline_after_date');
    return tErrors(result.error);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (needsDistrictConfirm) return;
    setSaving(true);
    setError(null);
    const payload = toPayload(form);
    const result = trip
      ? await patchJson<{ id: string }>(`/api/temple-trips/${trip.id}`, payload)
      : await postJson<{ id: string }>('/api/temple-trips', payload);
    setSaving(false);
    if (!result.ok) {
      setError(messageFor(result));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
    onSaved(result.data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            {trip ? t('editTrip') : t('newTrip')}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger" role="alert" title={error} />}

            <Field label={t('fields.templeName')} value={form.templeName} onChange={(event) => set('templeName', event.target.value)} maxLength={120} required />

            <Checkbox checked={form.inAssignedDistrict} onChange={(value) => set('inAssignedDistrict', value)} label={t('fields.inAssignedDistrict')} />
            {!form.inAssignedDistrict && (
              <Alert tone="warning" role="status" title={t('districtWarning')}>
                <Checkbox checked={confirmedOutside} onChange={setConfirmedOutside} label={t('confirmOutsideDistrict')} />
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field type="date" label={t('fields.date')} value={form.date} onChange={(event) => set('date', event.target.value)} required />
              <Field type="date" label={t('fields.registrationDeadline')} value={form.registrationDeadline} onChange={(event) => set('registrationDeadline', event.target.value)} required />
            </div>
            <Checkbox checked={form.dateConfirmed} onChange={(value) => set('dateConfirmed', value)} label={t('fields.dateConfirmed')} />
            <p className="text-sm text-text-muted">{t('fields.dateConfirmedHelp')}</p>

            <Checkbox checked={form.scheduledWithTemple} onChange={(value) => set('scheduledWithTemple', value)} label={t('fields.scheduledWithTemple')} />
            <Checkbox checked={form.active} onChange={(value) => set('active', value)} label={t('fields.active')} />
            <p className="text-sm text-text-muted">{t('fields.activeHelp')}</p>

            <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium text-text-muted">{t('services.legend')}</legend>

              <Checkbox checked={form.includesTransport} onChange={(value) => set('includesTransport', value)} label={t('services.includes', { service: t('services.transport') })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field type="number" min={0} step="0.01" inputMode="decimal" label={`${t('services.transport')} — ${t('services.cost')}`} value={form.costTransport} onChange={(event) => set('costTransport', event.target.value)} />
                <Field type="number" min={0} step="1" inputMode="numeric" label={`${t('services.transport')} — ${t('services.quota')}`} value={form.quotaTransport} onChange={(event) => set('quotaTransport', event.target.value)} />
              </div>

              <Checkbox checked={form.includesLodging} onChange={(value) => set('includesLodging', value)} label={t('services.includes', { service: t('services.lodging') })} />
              <Field type="number" min={0} step="1" inputMode="numeric" label={`${t('services.lodging')} — ${t('services.quota')}`} value={form.quotaLodging} onChange={(event) => set('quotaLodging', event.target.value)} />

              <Checkbox checked={form.includesBreakfast} onChange={(value) => set('includesBreakfast', value)} label={t('services.includes', { service: t('services.breakfast') })} />
              <Field type="number" min={0} step="0.01" inputMode="decimal" label={`${t('services.breakfast')} — ${t('services.cost')}`} value={form.costBreakfast} onChange={(event) => set('costBreakfast', event.target.value)} />

              <Checkbox checked={form.includesLunch} onChange={(value) => set('includesLunch', value)} label={t('services.includes', { service: t('services.lunch') })} />
              <Field type="number" min={0} step="0.01" inputMode="decimal" label={`${t('services.lunch')} — ${t('services.cost')}`} value={form.costLunch} onChange={(event) => set('costLunch', event.target.value)} />
            </fieldset>

            <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium text-text-muted">{t('quotas.legend')}</legend>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="px-2 py-1 text-left font-medium text-text-muted">{t('quotas.legend')}</th>
                      {GENDERS.map((gender) => (
                        <th key={gender} scope="col" className="px-2 py-1 text-center font-medium text-text-muted">
                          {t(`quotas.genders.${gender}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ORDINANCES.map((ordinance) => (
                      <tr key={ordinance}>
                        <th scope="row" className="px-2 py-1 text-left font-normal text-text">{t(`quotas.ordinances.${ordinance}`)}</th>
                        {GENDERS.map((gender) => {
                          const key = quotaKey(ordinance, gender);
                          return (
                            <td key={gender} className="px-2 py-1">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                inputMode="numeric"
                                aria-label={t('quotas.cell', { ordinance: t(`quotas.ordinances.${ordinance}`), gender: t(`quotas.genders.${gender}`) })}
                                value={form[key]}
                                onChange={(event) => set(key, event.target.value)}
                                className="w-full rounded-sm border border-border-strong bg-surface px-2 py-1 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={saving || needsDistrictConfirm}>
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
