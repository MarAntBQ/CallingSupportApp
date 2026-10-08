'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { patchJson, postJson, type ApiResult } from '@/lib/api-client';
import { GENDERS, MIN_AGE_ORDINANCES, ORDINANCES, calculateAge, normalizeIdNumber, type Gender, type Ordinance } from '@/lib/temple-trips/constants';
import type { TempleTripListItem } from '@/lib/temple-trips/types';
import type { ParticipantListItem } from '@/server/temple-trips/registrations';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';

type SubTab = 'pending' | 'approved' | 'all';

export function participantsKey(tripId: string) {
  return ['temple-participants', tripId] as const;
}

export async function fetchParticipants(tripId: string): Promise<ParticipantListItem[]> {
  const response = await fetch(`/api/temple-trips/${tripId}/participants`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`participants ${response.status}`);
  return response.json();
}

const money = (value: string, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(Number(value));

export function ParticipantsPanel({
  trip,
  allTrips,
  canCreate,
  canUpdate,
}: {
  trip: TempleTripListItem;
  allTrips: TempleTripListItem[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const t = useTranslations('templeTrips.participants');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: participants = [] } = useQuery({ queryKey: participantsKey(trip.id), queryFn: () => fetchParticipants(trip.id) });

  const [subtab, setSubtab] = useState<SubTab>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ParticipantListItem | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () => participants.filter((p) => (subtab === 'pending' ? !p.approved : subtab === 'approved' ? p.approved : true)),
    [participants, subtab],
  );

  const search = (p: ParticipantListItem) => `${p.fullName} ${p.idNumber} ${p.phone} ${p.email}`;
  const sortAccessors = useMemo<SortAccessors<ParticipantListItem>>(
    () => ({ participant: (p) => p.fullName, cost: (p) => Number(p.totalCost), status: (p) => (p.approved ? 1 : 0) }),
    [],
  );
  const table = useTableControls(rows, { search, defaultSortKey: 'participant', sortAccessors, locale });

  const refresh = () => queryClient.invalidateQueries({ queryKey: participantsKey(trip.id) });

  const filteredIds = useMemo(() => {
    const term = table.search.trim().toLowerCase();
    return rows.filter((p) => (term ? search(p).toLowerCase().includes(term) : true)).map((p) => p.id);
  }, [rows, table.search]);

  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));

  function toggleAll(checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function approveMany(approved: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    setStatus(null);
    const results = await Promise.all(ids.map((id) => postJson(`/api/temple-participants/${id}/approval`, { approved })));
    setBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    setStatus(approved ? t('summary', { approved: results.length - failed, failed }) : t('summaryDisapproved', { n: results.length - failed }));
    setSelected(new Set());
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(['pending', 'approved', 'all'] as const).map((key) => (
            <Button
              key={key}
              role="tab"
              aria-selected={subtab === key}
              variant={subtab === key ? 'secondary' : 'link'}
              onClick={() => {
                setSubtab(key);
                setSelected(new Set());
              }}
            >
              {t(`subtabs.${key}`)}
            </Button>
          ))}
        </div>
        {canCreate && <Button onClick={() => setCreating(true)}>{t('newRegistration')}</Button>}
      </div>

      {status && <Alert tone="info" role="status" title={status} />}

      {participants.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="min-w-0 rounded-md border border-border bg-surface">
          <TableToolbar table={table} />
          {canUpdate && someSelected && (
            <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2">
              <Button variant="secondary" disabled={busy} onClick={() => void approveMany(true)}>
                {t('approveSelected')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void approveMany(false)}>
                {t('disapproveSelected')}
              </Button>
            </div>
          )}
          <TableScroll label={t('tab')}>
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  {canUpdate && (
                    <th scope="col" className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label={t('selectAll')}
                        checked={allSelected}
                        ref={(node) => {
                          if (node) node.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={(event) => toggleAll(event.target.checked)}
                      />
                    </th>
                  )}
                  <SortHeader table={table} column="participant" label={t('columns.participant')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.contact')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.ordinances')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.services')}</th>
                  <SortHeader table={table} column="cost" label={t('columns.cost')} />
                  <SortHeader table={table} column="status" label={t('columns.status')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {table.view.map((p) => (
                  <tr key={p.id} className="even:bg-surface-muted">
                    {canUpdate && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          aria-label={t('select', { name: p.fullName })}
                          checked={selected.has(p.id)}
                          onChange={(event) => toggleOne(p.id, event.target.checked)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <button type="button" className="text-left font-medium text-primary underline-offset-4 hover:underline" onClick={() => setEditing(p)}>
                        {p.fullName}
                      </button>
                      <div className="text-xs text-text-muted">{p.idNumber}</div>
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      <div>{p.phone}</div>
                      <div className="text-xs">{p.email}</div>
                    </td>
                    <td className="px-3 py-2 text-text-muted">{p.ordinances.length > 0 ? p.ordinances.length : t('none')}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {[p.wantsTransport, p.needsLodging, p.wantsBreakfast, p.wantsLunch].filter(Boolean).length}
                    </td>
                    <td className="px-3 py-2 text-text">{money(p.totalCost, locale)}</td>
                    <td className="px-3 py-2">{t(`status.${p.approved ? 'approved' : 'pending'}`)}</td>
                    <td className="px-3 py-2">
                      {canUpdate && (
                        <ApproveButton participant={p} onDone={refresh} onError={setStatus} />
                      )}
                    </td>
                  </tr>
                ))}
                {table.view.length === 0 && (
                  <tr>
                    <td colSpan={canUpdate ? 8 : 7} className="px-4 py-6 text-center text-text-muted">
                      {t('noRows')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
          <TablePagination table={table} />
        </div>
      )}

      {editing && <ParticipantModal trip={trip} participant={editing} canUpdate={canUpdate} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />}
      {creating && <NewRegistrationModal trips={allTrips} defaultTripId={trip.id} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} />}
    </div>
  );
}

function ApproveButton({ participant, onDone, onError }: { participant: ParticipantListItem; onDone: () => Promise<unknown>; onError: (message: string) => void }) {
  const t = useTranslations('templeTrips.participants');
  const tErrors = useTranslations('errors');
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const result = await postJson(`/api/temple-participants/${participant.id}/approval`, { approved: !participant.approved });
    setBusy(false);
    if (result.ok) await onDone();
    else onError(result.status === 409 ? t('errors.no_quota') : tErrors(result.error));
  }
  return (
    <Button variant="link" disabled={busy} onClick={() => void toggle()}>
      {t(`actions.${participant.approved ? 'disapprove' : 'approve'}`)}
    </Button>
  );
}

const ERROR_KEYS = ['no_quota', 'age_ordinance', 'duplicate_existing', 'empty_id'] as const;

function codeOf(result: Extract<ApiResult<unknown>, { ok: false }>): (typeof ERROR_KEYS)[number] | null {
  const code = result.issues[0]?.code;
  return ERROR_KEYS.find((candidate) => candidate === code) ?? null;
}

type Draft = {
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

function emptyDraft(): Draft {
  return { idNumber: '', birthDate: '', fullName: '', phone: '', email: '', gender: '', wantsTransport: false, needsLodging: false, wantsBreakfast: false, wantsLunch: false, ordinances: [] };
}

function PersonFields({ trip, draft, onChange, disabled = false }: { trip: TempleTripListItem; draft: Draft; onChange: (patch: Partial<Draft>) => void; disabled?: boolean }) {
  const t = useTranslations('templeTrips.public');
  const tGenders = useTranslations('templeTrips.quotas.genders');
  const tOrdinances = useTranslations('templeTrips.quotas.ordinances');
  const canOrdinance = Boolean(draft.gender) && Boolean(draft.birthDate) && calculateAge(draft.birthDate, trip.date) >= MIN_AGE_ORDINANCES;

  const allServices: { include: boolean; key: keyof Draft; label: string }[] = [
    { include: trip.includesTransport, key: 'wantsTransport', label: t('wants.transport') },
    { include: trip.includesLodging, key: 'needsLodging', label: t('wants.lodging') },
    { include: trip.includesBreakfast, key: 'wantsBreakfast', label: t('wants.breakfast') },
    { include: trip.includesLunch, key: 'wantsLunch', label: t('wants.lunch') },
  ];
  const services = allServices.filter((item) => item.include);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fields.idNumber')} value={draft.idNumber} disabled={disabled} onChange={(event) => onChange({ idNumber: normalizeIdNumber(event.target.value) })} />
        <Field type="date" label={t('fields.birthDate')} value={draft.birthDate} disabled={disabled} onChange={(event) => onChange({ birthDate: event.target.value })} />
        <Field label={t('fields.fullName')} value={draft.fullName} disabled={disabled} onChange={(event) => onChange({ fullName: event.target.value })} />
        <Field type="tel" label={t('fields.phone')} value={draft.phone} disabled={disabled} onChange={(event) => onChange({ phone: event.target.value })} />
        <Field type="email" label={t('fields.email')} value={draft.email} disabled={disabled} onChange={(event) => onChange({ email: event.target.value })} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t('fields.gender')}</span>
          <select
            aria-label={t('fields.gender')}
            disabled={disabled}
            className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
            value={draft.gender}
            onChange={(event) => onChange({ gender: event.target.value as Gender, ordinances: [] })}
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
      {services.length > 0 && (
        <div className="flex flex-col gap-2">
          {services.map((item) => (
            <label key={item.key} className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" className="size-4 accent-primary" checked={Boolean(draft[item.key])} disabled={disabled} onChange={(event) => onChange({ [item.key]: event.target.checked } as Partial<Draft>)} />
              {item.label}
            </label>
          ))}
        </div>
      )}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium text-text-muted">{t('ordinancesLegend')}</legend>
        {ORDINANCES.map((ordinance) => (
          <label key={ordinance} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={draft.ordinances.includes(ordinance)}
              disabled={!canOrdinance || disabled}
              onChange={(event) => onChange({ ordinances: event.target.checked ? [...draft.ordinances, ordinance] : draft.ordinances.filter((item) => item !== ordinance) })}
            />
            {tOrdinances(ordinance)}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function draftPayload(draft: Draft) {
  return {
    idNumber: draft.idNumber.trim(),
    birthDate: draft.birthDate,
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim(),
    gender: draft.gender,
    wantsTransport: draft.wantsTransport,
    needsLodging: draft.needsLodging,
    wantsBreakfast: draft.wantsBreakfast,
    wantsLunch: draft.wantsLunch,
    ordinances: draft.ordinances,
  };
}

function ParticipantModal({ trip, participant, canUpdate, onClose, onSaved }: { trip: TempleTripListItem; participant: ParticipantListItem; canUpdate: boolean; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const t = useTranslations('templeTrips.participants');
  const tErrors = useTranslations('errors');
  const tPublic = useTranslations('templeTrips.public');
  const locale = useLocale();
  const titleId = useId();
  const [draft, setDraft] = useState<Draft>({
    idNumber: participant.idNumber,
    birthDate: participant.birthDate,
    fullName: participant.fullName,
    phone: participant.phone,
    email: participant.email,
    gender: participant.gender as Gender,
    wantsTransport: participant.wantsTransport,
    needsLodging: participant.needsLodging,
    wantsBreakfast: participant.wantsBreakfast,
    wantsLunch: participant.wantsLunch,
    ordinances: participant.ordinances as Ordinance[],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const registrationDate = new Date(participant.registrationDate).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await patchJson(`/api/temple-participants/${participant.id}`, draftPayload(draft));
    setSaving(false);
    if (!result.ok) {
      const code = codeOf(result);
      setError(code ? t(`errors.${code}`, { age: MIN_AGE_ORDINANCES }) : tErrors(result.error));
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">{t('modal.title')}</h2>
          <p className="text-sm text-text-muted">{t('modal.registration', { date: registrationDate })}</p>
          <p className="text-sm text-text-muted">{t('modal.consent', { version: participant.policyVersion })}</p>
          <p className="text-sm font-medium text-text">
            {t('modal.estimatedCost', { cost: new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(Number(participant.totalCost)) })}
          </p>
          {trip.donationCategoryName && (
            <p className="text-sm text-text-muted">{tPublic('contributionCategory', { category: trip.donationCategoryName })}</p>
          )}
          {trip.donationInstructions && <p className="text-sm text-text-muted">{trip.donationInstructions}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger" role="alert" title={error} />}
            <PersonFields trip={trip} draft={draft} disabled={!canUpdate} onChange={(patch) => setDraft((previous) => ({ ...previous, ...patch }))} />
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>{t('modal.cancel')}</Button>
          {canUpdate && <Button type="submit" disabled={saving}>{t('modal.save')}</Button>}
        </div>
      </form>
    </div>
  );
}

function NewRegistrationModal({ trips, defaultTripId, onClose, onSaved }: { trips: TempleTripListItem[]; defaultTripId: string; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const t = useTranslations('templeTrips.participants');
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const tPublic = useTranslations('templeTrips.public');
  const titleId = useId();
  const [tripId, setTripId] = useState(defaultTripId);
  const [people, setPeople] = useState<Draft[]>([emptyDraft()]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trip = trips.find((item) => item.id === tripId) ?? trips[0]!;

  const complete = people.every((p) => p.idNumber.trim() && p.birthDate && p.fullName.trim() && p.phone.trim() && p.email.trim() && p.gender);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent || !complete) return;
    setSaving(true);
    setError(null);
    const result = await postJson(`/api/temple-trips/${tripId}/registrations`, { consent: true, participants: people.map(draftPayload) });
    setSaving(false);
    if (!result.ok) {
      const code = codeOf(result);
      setError(code ? t(`errors.${code}`, { age: MIN_AGE_ORDINANCES }) : tErrors(result.error));
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">{t('create.title')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger" role="alert" title={error} />}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('create.trip')}</span>
              <select
                aria-label={t('create.trip')}
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                value={tripId}
                onChange={(event) => setTripId(event.target.value)}
              >
                {trips.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.templeName} ${item.active ? t('create.activeTag') : ''} ${item.dateConfirmed ? '' : t('create.toConfirmTag')}`.trim()}
                  </option>
                ))}
              </select>
            </label>
            {people.map((person, index) => (
              <div key={index} className="rounded-md border border-border p-3">
                <PersonFields trip={trip} draft={person} onChange={(patch) => setPeople((previous) => previous.map((item, current) => (current === index ? { ...item, ...patch } : item)))} />
                {people.length > 1 && (
                  <Button type="button" variant="link" onClick={() => setPeople((previous) => previous.filter((_, current) => current !== index))}>
                    {tPublic('removeParticipant')}
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="secondary" className="self-start" disabled={!complete} onClick={() => setPeople((previous) => [...previous, { ...emptyDraft(), phone: previous[0]!.phone, email: previous[0]!.email }])}>
              {tPublic('addParticipant')}
            </Button>
            <p className="text-sm text-text-muted">
              {t('create.dataNotice')}{' '}
              <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline">
                {tCommon('privacyLink')}
              </Link>
            </p>
            <label className="flex items-start gap-2 text-sm text-text">
              <input type="checkbox" className="mt-1 size-4 accent-primary" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>{t('create.consent')}</span>
            </label>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>{t('modal.cancel')}</Button>
          <Button type="submit" disabled={saving || !consent || !complete}>{t('create.submit')}</Button>
        </div>
      </form>
    </div>
  );
}
