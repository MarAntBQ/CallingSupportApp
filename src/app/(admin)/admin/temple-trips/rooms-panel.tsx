'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { deleteJson, patchJson, postJson, type ApiResult } from '@/lib/api-client';
import { useConfig } from '@/lib/config/use-config';
import { ROOM_CAPACITY, splitFullName } from '@/lib/temple-trips/constants';
import type { TempleTripListItem } from '@/lib/temple-trips/types';
import type { RoomOccupant, RoomView, RoomsView } from '@/server/temple-trips/rooms';

const ROOM_ERROR_CODES = ['no_lodging', 'not_approved', 'room_other_trip', 'room_full', 'too_many_leaders', 'no_rooms', 'generic'] as const;
type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

function roomsKey(tripId: string) {
  return ['temple-rooms', tripId] as const;
}

async function fetchRooms(tripId: string): Promise<RoomsView> {
  const response = await fetch(`/api/temple-trips/${tripId}/rooms`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`rooms ${response.status}`);
  return response.json();
}

export function RoomsPanel({
  trip,
  canCreate,
  canUpdate,
  canDelete,
}: {
  trip: TempleTripListItem;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('templeTrips.rooms');
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: roomsKey(trip.id), queryFn: () => fetchRooms(trip.id) });

  const [newNumber, setNewNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [excelOpen, setExcelOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: roomsKey(trip.id) });

  function reportError(result: ApiResult<unknown>) {
    if (result.ok) {
      setError(null);
      return;
    }
    const code = result.issues[0]?.code ?? result.error;
    const known = (ROOM_ERROR_CODES as readonly string[]).includes(code) ? (code as RoomErrorCode) : 'generic';
    setError(t(`errors.${known}`));
  }

  async function run(action: () => Promise<ApiResult<unknown>>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      reportError(result);
      return false;
    }
    await refresh();
    return true;
  }

  async function addRoom(event: FormEvent) {
    event.preventDefault();
    const number = newNumber.trim();
    if (!number) return;
    if (await run(() => postJson(`/api/temple-trips/${trip.id}/rooms`, { number }))) setNewNumber('');
  }

  const assign = (participantId: string, roomId: string | null, role?: 'leader' | 'guest') =>
    run(() => patchJson(`/api/temple-participants/${participantId}/room`, { roomId, ...(role ? { role } : {}) }));

  async function removeRoom(roomId: string) {
    if (await run(() => deleteJson(`/api/temple-rooms/${roomId}`))) setConfirmDelete(null);
  }

  if (!data) return <p className="text-sm text-text-muted">{t('loading')}</p>;
  if (!data.includesLodging) return <p className="text-sm text-text-muted">{t('noLodging')}</p>;

  const assignedOccupants = data.rooms.flatMap((room) => room.occupants.map((occupant) => ({ ...occupant, roomNumber: room.number })));

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      {canCreate && (
        <form onSubmit={addRoom} className="flex items-end gap-2">
          <Field
            label={t('addRoom')}
            name="number"
            value={newNumber}
            onChange={(event) => setNewNumber(event.target.value)}
            placeholder={t('numberPlaceholder')}
            className="max-w-[12rem]"
          />
          <Button type="submit" disabled={busy || newNumber.trim().length === 0}>
            {t('add')}
          </Button>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">{t('unassigned')}</h3>
        {data.unassigned.length === 0 ? (
          <p className="text-sm text-text-muted">{t('noUnassigned')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.unassigned.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="text-sm text-text">{person.fullName}</span>
                {canUpdate && data.rooms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.rooms.map((room) => (
                      <Button
                        key={room.id}
                        variant="secondary"
                        className="px-2.5 py-1 text-sm"
                        disabled={busy || room.occupants.length >= ROOM_CAPACITY}
                        onClick={() => assign(person.id, room.id)}
                      >
                        {t('assignTo', { number: room.number, count: room.occupants.length, capacity: ROOM_CAPACITY })}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {data.rooms.length === 0 ? (
          <p className="text-sm text-text-muted">{t('noRooms')}</p>
        ) : (
          data.rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              canUpdate={canUpdate}
              canDelete={canDelete}
              busy={busy}
              confirming={confirmDelete === room.id}
              onConfirmDelete={() => setConfirmDelete(room.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onDelete={() => removeRoom(room.id)}
              onMakeLeader={(id) => assign(id, room.id, 'leader')}
              onUnmakeLeader={(id) => assign(id, room.id, 'guest')}
              onRemove={(id) => assign(id, null)}
            />
          ))
        )}
      </section>

      {assignedOccupants.length > 0 && (
        <div>
          <Button variant="secondary" onClick={() => setExcelOpen(true)}>
            {t('generateExcel')}
          </Button>
        </div>
      )}

      {excelOpen && <ExcelModal tripId={trip.id} occupants={assignedOccupants} onClose={() => setExcelOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function RoomCard({
  room,
  canUpdate,
  canDelete,
  busy,
  confirming,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  onMakeLeader,
  onUnmakeLeader,
  onRemove,
}: {
  room: RoomView;
  canUpdate: boolean;
  canDelete: boolean;
  busy: boolean;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onMakeLeader: (id: string) => void;
  onUnmakeLeader: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('templeTrips.rooms');
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text">{t('roomTitle', { number: room.number })}</span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted">{t('badge', { count: room.occupants.length, capacity: ROOM_CAPACITY })}</span>
          <span className="text-xs text-text-muted">{t('leaders', { count: room.leaders })}</span>
        </div>
        {canDelete &&
          (confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{t('confirmDelete')}</span>
              <Button variant="secondary" className="px-2.5 py-1 text-sm text-danger-strong" disabled={busy} onClick={onDelete}>
                {t('deleteConfirm')}
              </Button>
              <Button variant="link" className="text-sm" onClick={onCancelDelete}>
                {t('cancel')}
              </Button>
            </div>
          ) : (
            <Button variant="link" className="text-sm text-danger-strong" onClick={onConfirmDelete}>
              {t('deleteRoom')}
            </Button>
          ))}
      </div>
      {room.occupants.length === 0 ? (
        <p className="text-sm text-text-muted">{t('emptyRoom')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {room.occupants.map((occupant) => (
            <li key={occupant.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1.5 first:border-t-0 first:pt-0">
              <span className="flex items-center gap-2 text-sm text-text">
                {occupant.fullName}
                {occupant.roomRole === 'leader' && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{t('leaderTag')}</span>}
              </span>
              {canUpdate && (
                <div className="flex flex-wrap gap-1.5">
                  {occupant.roomRole === 'leader' ? (
                    <Button variant="link" className="text-sm" disabled={busy} onClick={() => onUnmakeLeader(occupant.id)}>
                      {t('unmakeLeader')}
                    </Button>
                  ) : (
                    room.leaders < 2 && (
                      <Button variant="link" className="text-sm" disabled={busy} onClick={() => onMakeLeader(occupant.id)}>
                        {t('makeLeader')}
                      </Button>
                    )
                  )}
                  <Button variant="link" className="text-sm text-danger-strong" disabled={busy} onClick={() => onRemove(occupant.id)}>
                    {t('remove')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Draft = { lastNames: string; firstNames: string; nationality: string };

function ExcelModal({
  tripId,
  occupants,
  onClose,
  onSaved,
}: {
  tripId: string;
  occupants: (RoomOccupant & { roomNumber: string })[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const t = useTranslations('templeTrips.rooms');
  const { data: config } = useConfig();
  const defaultNationality = config?.defaultNationality ?? '';
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      occupants.map((occupant) => {
        const split = splitFullName(occupant.fullName);
        return [
          occupant.id,
          {
            lastNames: occupant.lastNames ?? split.lastNames,
            firstNames: occupant.firstNames ?? split.firstNames,
            nationality: occupant.nationality ?? defaultNationality,
          },
        ];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, key: keyof Draft, value: string) {
    setDrafts((previous) => ({ ...previous, [id]: { ...previous[id]!, [key]: value } }));
  }

  async function saveAndDownload(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const results = await Promise.all(
      occupants.map((occupant) => patchJson(`/api/temple-participants/${occupant.id}/housing-data`, drafts[occupant.id]!)),
    );
    if (results.some((result) => !result.ok)) {
      setBusy(false);
      setError(t('errors.saveFailed'));
      return;
    }
    await onSaved();
    try {
      const response = await fetch(`/api/temple-trips/${tripId}/rooms/excel`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`excel ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `habitaciones-viaje-${tripId}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBusy(false);
      setError(t('errors.downloadFailed'));
      return;
    }
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t('excelTitle')}>
      <form onSubmit={saveAndDownload} className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text">{t('excelTitle')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Alert tone="warning" title={t('dataNoticeTitle')}>
            {t('dataNotice')}
          </Alert>
          {error && (
            <div className="mt-4">
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            </div>
          )}
          <ul className="mt-4 flex flex-col gap-4">
            {occupants.map((occupant) => (
              <li key={occupant.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-text">
                  {occupant.fullName} <span className="text-text-muted">· {t('roomTitle', { number: occupant.roomNumber })}</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t('lastNames')} name={`last-${occupant.id}`} value={drafts[occupant.id]!.lastNames} onChange={(event) => update(occupant.id, 'lastNames', event.target.value)} />
                  <Field label={t('firstNames')} name={`first-${occupant.id}`} value={drafts[occupant.id]!.firstNames} onChange={(event) => update(occupant.id, 'firstNames', event.target.value)} />
                  <Field label={t('nationality')} name={`nat-${occupant.id}`} value={drafts[occupant.id]!.nationality} onChange={(event) => update(occupant.id, 'nationality', event.target.value)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="link" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('saveAndDownload')}
          </Button>
        </div>
      </form>
    </div>
  );
}
