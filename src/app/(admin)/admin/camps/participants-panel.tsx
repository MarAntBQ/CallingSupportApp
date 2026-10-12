'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { patchJson, postJson, type ApiResult } from '@/lib/api-client';
import { GENDERS, PARTICIPANT_TYPES, type Gender, type ParticipantType } from '@/lib/camps/constants';
import { formatMoney } from '@/lib/format';
import { isLocale } from '@/i18n/config';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import type { CampItem, CampParticipantItem } from '@/lib/validation/camps';

const SUBTABS = ['youth', 'leader', 'pending'] as const;
type Subtab = (typeof SUBTABS)[number];
const SELECT =
  'w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary disabled:bg-surface-muted disabled:text-text-muted';
const KNOWN = ['quota_full', 'no_email', 'birth_date_required', 'emergency_contact_required', 'future_date'] as const;

export const participantsKey = (campId: string) => ['camps', campId, 'participants'] as const;

async function fetchParticipants(campId: string): Promise<CampParticipantItem[]> {
  const response = await fetch(`/api/camps/${campId}/participants`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`participants ${response.status}`);
  return response.json();
}

function useMessage() {
  const t = useTranslations('camps.participants');
  const tErrors = useTranslations('errors');
  return (result: Extract<ApiResult<unknown>, { ok: false }>) => {
    const code = KNOWN.find((known) => result.issues.some((issue) => issue.code === known));
    if (code) return t(`errors.${code}`);
    if (result.error === 'invalid_input') return t('errors.fields');
    return tErrors(result.error);
  };
}

export function ParticipantsPanel({ camp, canCreate, canUpdate }: { camp: CampItem; canCreate: boolean; canUpdate: boolean }) {
  const t = useTranslations('camps.participants');
  const locale = useLocale();
  const money = (value: string) => formatMoney(Number(value), isLocale(locale) ? locale : 'es');
  const message = useMessage();
  const queryClient = useQueryClient();
  const { data: participants = [], isError } = useQuery({ queryKey: participantsKey(camp.id), queryFn: () => fetchParticipants(camp.id) });
  const [subtab, setSubtab] = useState<Subtab>('youth');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CampParticipantItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const rows = useMemo(
    () => participants.filter((person) => (subtab === 'pending' ? !person.approved : person.type === subtab)),
    [participants, subtab],
  );
  const search = (person: CampParticipantItem) => `${person.fullName} ${person.guardianName ?? ''} ${person.email ?? ''}`;
  const sortAccessors = useMemo<SortAccessors<CampParticipantItem>>(
    () => ({ name: (person) => person.fullName, gender: (person) => person.gender, status: (person) => (person.approved ? 1 : 0) }),
    [],
  );
  const table = useTableControls(rows, { search, defaultSortKey: 'name', sortAccessors, locale });
  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: participantsKey(camp.id) }), queryClient.invalidateQueries({ queryKey: ['camps'] })]);

  async function approveSelected(approved: boolean) {
    setBusy(true);
    setNotice(null);
    let done = 0;
    const failures: string[] = [];
    for (const id of selected) {
      const result = await postJson(`/api/camp-participants/${id}/approval`, { approved });
      if (result.ok) done += 1;
      else failures.push(`${participants.find((person) => person.id === id)?.fullName ?? ''}: ${message(result)}`);
    }
    setBusy(false);
    setSelected(new Set());
    setNotice(failures.length ? { tone: 'danger', text: `${t('bulk.done', { n: done })} ${failures.join(' · ')}` } : { tone: 'success', text: t('bulk.done', { n: done }) });
    await refresh();
  }

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('title')}>
          {SUBTABS.map((key) => (
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
        {canCreate && <Button onClick={() => setCreating(true)}>{t('add')}</Button>}
      </div>

      {isError && <Alert tone="danger" role="alert" title={t('loadFailed')} />}
      {notice && <Alert tone={notice.tone} role="status" title={notice.text} />}

      {canUpdate && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-muted p-3">
          <span className="text-sm text-text">{t('bulk.selected', { n: selected.size })}</span>
          <Button disabled={busy} onClick={() => void approveSelected(true)}>
            {t('bulk.approve')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void approveSelected(false)}>
            {t('bulk.unapprove')}
          </Button>
        </div>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="min-w-0 rounded-md border border-border bg-surface">
          <TableToolbar table={table} />
          <TableScroll label={t('title')}>
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  {canUpdate && (
                    <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">
                      <span className="sr-only">{t('columns.select')}</span>
                    </th>
                  )}
                  <SortHeader table={table} column="name" label={t('columns.name')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.type')}</th>
                  <SortHeader table={table} column="gender" label={t('columns.gender')} />
                  <SortHeader table={table} column="status" label={t('columns.status')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.form')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.packing')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.contribution')}</th>
                </tr>
              </thead>
              <tbody>
                {table.view.map((person) => (
                  <tr key={person.id} className="even:bg-surface-muted" data-testid="camp-participant-row">
                    {canUpdate && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          aria-label={t('selectOne', { name: person.fullName })}
                          checked={selected.has(person.id)}
                          onChange={() => toggle(person.id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <button type="button" className="text-left font-medium text-primary underline-offset-4 hover:underline" onClick={() => setEditing(person)}>
                        {person.fullName}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-text-muted">{t(`types.${person.type}`)}</td>
                    <td className="px-3 py-2 text-text-muted">{t(`genders.${person.gender}`)}</td>
                    <td className="px-3 py-2">{person.approved ? t('approved') : t('pending')}</td>
                    <td className="px-3 py-2 text-text-muted">{person.permissionFormReceived ? t('formYes') : t('formNo')}</td>
                    <td className="px-3 py-2 text-text-muted">{t('packing', { done: person.packingDone, total: person.packingTotal })}</td>
                    <td className="px-3 py-2 text-text-muted">{Number(person.suggestedContribution) > 0 ? money(person.suggestedContribution) : t('none')}</td>
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

      {editing && (
        <ParticipantModal
          person={editing}
          canUpdate={canUpdate}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {creating && (
        <AddModal
          campId={camp.id}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function Modal({ title, children, footer, onSubmit }: { title: string; children: React.ReactNode; footer: React.ReactNode; onSubmit: (event: FormEvent) => void }) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form noValidate onSubmit={onSubmit} className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            {title}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
      </form>
    </div>
  );
}

function ParticipantModal({
  person,
  canUpdate,
  onClose,
  onSaved,
}: {
  person: CampParticipantItem;
  canUpdate: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const t = useTranslations('camps.participants');
  const message = useMessage();
  const [draft, setDraft] = useState({
    fullName: person.fullName,
    birthDate: person.birthDate ?? '',
    gender: person.gender as Gender,
    phone: person.phone ?? '',
    email: person.email ?? '',
    emergencyContactName: person.emergencyContactName ?? '',
    emergencyContactPhone: person.emergencyContactPhone ?? '',
    permissionFormReceived: person.permissionFormReceived,
  });
  const [approved, setApproved] = useState(person.approved);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<typeof draft>) => setDraft((previous) => ({ ...previous, ...next }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;
    setSaving(true);
    setError(null);
    const body = {
      fullName: draft.fullName.trim(),
      ...(draft.birthDate ? { birthDate: draft.birthDate } : {}),
      gender: draft.gender,
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      ...(person.type === 'youth' ? { emergencyContactName: draft.emergencyContactName.trim(), emergencyContactPhone: draft.emergencyContactPhone.trim() } : {}),
      permissionFormReceived: draft.permissionFormReceived,
    };
    const result = await patchJson(`/api/camp-participants/${person.id}`, body);
    if (result.ok && approved !== person.approved) {
      const approval = await postJson(`/api/camp-participants/${person.id}/approval`, { approved });
      if (!approval.ok) {
        setSaving(false);
        setError(message(approval));
        return;
      }
    }
    setSaving(false);
    if (!result.ok) {
      setError(message(result));
      return;
    }
    await onSaved();
  }

  async function newLink() {
    setError(null);
    setInfo(null);
    const result = await postJson(`/api/camp-participants/${person.id}/access-link`, {});
    if (!result.ok) setError(message(result));
    else setInfo(t('linkSent'));
  }

  return (
    <Modal
      title={t('modal.editTitle')}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('modal.cancel')}
          </Button>
          {canUpdate && (
            <Button type="submit" disabled={saving}>
              {t('modal.save')}
            </Button>
          )}
        </>
      }
    >
      {error && <Alert tone="danger" role="alert" title={error} />}
      {info && <Alert tone="success" role="status" title={info} />}
      <fieldset disabled={!canUpdate} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{t(`types.${person.type}`)}</p>
        <Field label={t('fields.fullName')} value={draft.fullName} onChange={(event) => patch({ fullName: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field type="date" label={t('fields.birthDate')} value={draft.birthDate} onChange={(event) => patch({ birthDate: event.target.value })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-muted">{t('fields.gender')}</span>
            <select aria-label={t('fields.gender')} className={SELECT} value={draft.gender} onChange={(event) => patch({ gender: event.target.value as Gender })}>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {t(`genders.${gender}`)}
                </option>
              ))}
            </select>
          </label>
          <Field type="tel" label={t('fields.phone')} value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} />
          <Field type="email" label={t('fields.email')} value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
        </div>
        {person.type === 'youth' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('fields.emergencyContactName')} value={draft.emergencyContactName} onChange={(event) => patch({ emergencyContactName: event.target.value })} />
            <Field type="tel" label={t('fields.emergencyContactPhone')} value={draft.emergencyContactPhone} onChange={(event) => patch({ emergencyContactPhone: event.target.value })} />
          </div>
        )}
        {person.guardianName && (
          <p className="text-sm text-text-muted">{t('guardian', { name: person.guardianName, phone: person.guardianPhone ?? '', email: person.guardianEmail ?? '' })}</p>
        )}
        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={draft.permissionFormReceived}
            onChange={(event) => patch({ permissionFormReceived: event.target.checked })}
          />
          <span>{t('fields.permissionForm')}</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
          <span>{t('fields.approved')}</span>
        </label>
      </fieldset>
      {canUpdate && (
        <div className="flex flex-col gap-1 rounded-md border border-border p-3">
          <Button variant="secondary" className="self-start" onClick={() => void newLink()}>
            {t('newLink')}
          </Button>
          <p className="text-xs text-text-muted">{t('newLinkHelp')}</p>
        </div>
      )}
    </Modal>
  );
}

type NewPerson = {
  type: ParticipantType;
  fullName: string;
  birthDate: string;
  gender: '' | Gender;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

function AddModal({ campId, onClose, onSaved }: { campId: string; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const t = useTranslations('camps.participants');
  const message = useMessage();
  const [person, setPerson] = useState<NewPerson>({
    type: 'leader',
    fullName: '',
    birthDate: '',
    gender: '',
    phone: '',
    email: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<NewPerson>) => setPerson((previous) => ({ ...previous, ...next }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent || !person.gender) return;
    setSaving(true);
    setError(null);
    const result = await postJson(`/api/camps/${campId}/registrations`, {
      participants: [
        {
          type: person.type,
          fullName: person.fullName.trim(),
          ...(person.birthDate ? { birthDate: person.birthDate } : {}),
          gender: person.gender,
          phone: person.phone.trim(),
          email: person.email.trim(),
          emergencyContactName: person.emergencyContactName.trim(),
          emergencyContactPhone: person.emergencyContactPhone.trim(),
        },
      ],
      consentConfirmed: true,
    });
    setSaving(false);
    if (!result.ok) {
      setError(message(result));
      return;
    }
    await onSaved();
  }

  return (
    <Modal
      title={t('modal.addTitle')}
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('modal.cancel')}
          </Button>
          <Button type="submit" disabled={saving || !consent || !person.gender || person.fullName.trim().length < 3}>
            {t('modal.add')}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger" role="alert" title={error} />}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-muted">{t('fields.type')}</span>
        <select aria-label={t('fields.type')} className={SELECT} value={person.type} onChange={(event) => patch({ type: event.target.value as ParticipantType })}>
          {PARTICIPANT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <Field label={t('fields.fullName')} value={person.fullName} onChange={(event) => patch({ fullName: event.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field type="date" label={t('fields.birthDate')} value={person.birthDate} onChange={(event) => patch({ birthDate: event.target.value })} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t('fields.gender')}</span>
          <select aria-label={t('fields.gender')} className={SELECT} value={person.gender} onChange={(event) => patch({ gender: event.target.value as Gender })}>
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
        <Field type="tel" label={t('fields.phone')} value={person.phone} onChange={(event) => patch({ phone: event.target.value })} />
        <Field type="email" label={t('fields.email')} hint={t('fields.emailHint')} value={person.email} onChange={(event) => patch({ email: event.target.value })} />
      </div>
      {person.type === 'youth' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('fields.emergencyContactName')} value={person.emergencyContactName} onChange={(event) => patch({ emergencyContactName: event.target.value })} />
          <Field type="tel" label={t('fields.emergencyContactPhone')} value={person.emergencyContactPhone} onChange={(event) => patch({ emergencyContactPhone: event.target.value })} />
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-text">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{t('fields.consentConfirmed')}</span>
      </label>
    </Modal>
  );
}
