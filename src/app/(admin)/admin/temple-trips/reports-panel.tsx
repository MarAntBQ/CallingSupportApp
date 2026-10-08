'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { patchJson } from '@/lib/api-client';
import { useConfig } from '@/lib/config/use-config';
import { GENDERS, ORDINANCES, compareNatural, quotaKey, type Gender } from '@/lib/temple-trips/constants';
import type { TempleTripListItem } from '@/lib/temple-trips/types';
import type { ParticipantListItem } from '@/server/temple-trips/registrations';
import type { RoomOccupant } from '@/server/temple-trips/rooms';
import { fetchParticipants, participantsKey } from './participants-panel';
import { fetchRooms, roomsKey } from './rooms-panel';

type ListKind = 'general' | 'transport' | 'breakfast' | 'lunch' | 'lodging' | 'ordinances';
type LogisticsField = 'boardedOutbound' | 'boardedReturn' | 'breakfastDelivered' | 'lunchDelivered';

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);

export function ReportsPanel({ trip, canUpdate }: { trip: TempleTripListItem; canUpdate: boolean }) {
  const t = useTranslations('templeTrips.reports');
  const tOrdinances = useTranslations('templeTrips.quotas.ordinances');
  const tGenders = useTranslations('templeTrips.quotas.genders');
  const tServices = useTranslations('templeTrips.public.wants');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: participants = [] } = useQuery({ queryKey: participantsKey(trip.id), queryFn: () => fetchParticipants(trip.id) });
  const { data: rooms } = useQuery({ queryKey: roomsKey(trip.id), queryFn: () => fetchRooms(trip.id) });

  const [includeAll, setIncludeAll] = useState(false);
  const [list, setList] = useState<ListKind>('general');
  const [logisticsError, setLogisticsError] = useState<string | null>(null);

  // Resumen: respeta el selector "Solo aprobados" / "Todos". Listas imprimibles: SIEMPRE solo aprobados.
  const summary = useMemo(() => participants.filter((p) => includeAll || p.approved), [participants, includeAll]);
  const approved = useMemo(
    () => participants.filter((p) => p.approved).sort((a, b) => a.fullName.localeCompare(b.fullName, locale)),
    [participants, locale],
  );

  const services = (['transport', 'lodging', 'breakfast', 'lunch'] as const).filter((s) =>
    s === 'transport' ? trip.includesTransport : s === 'lodging' ? trip.includesLodging : s === 'breakfast' ? trip.includesBreakfast : trip.includesLunch,
  );

  const cards = services.map((service) => {
    if (service === 'transport') return { service, count: summary.filter((p) => p.wantsTransport).length, quota: trip.quotaTransport };
    if (service === 'lodging') return { service, count: summary.filter((p) => p.needsLodging).length, quota: trip.quotaLodging };
    if (service === 'breakfast') return { service, count: summary.filter((p) => p.wantsBreakfast).length, quota: null };
    return { service, count: summary.filter((p) => p.wantsLunch).length, quota: null };
  });

  const ordinanceRows = ORDINANCES.map((ordinance) => {
    const men = summary.filter((p) => p.gender === 'male' && p.ordinances.includes(ordinance)).length;
    const women = summary.filter((p) => p.gender === 'female' && p.ordinances.includes(ordinance)).length;
    const quotaMen = trip[quotaKey(ordinance, 'male')];
    const quotaWomen = trip[quotaKey(ordinance, 'female')];
    return { ordinance, men, women, total: men + women, quotaMen, quotaWomen, quotaTotal: quotaMen + quotaWomen };
  });

  const estimatedCost = summary.reduce((sum, p) => sum + Number(p.totalCost), 0);

  const lists = (['general', 'transport', 'breakfast', 'lunch', ...(trip.includesLodging ? (['lodging'] as const) : []), 'ordinances'] as const).filter(
    (kind) => (kind === 'transport' ? trip.includesTransport : kind === 'breakfast' ? trip.includesBreakfast : kind === 'lunch' ? trip.includesLunch : true),
  );
  const activeList = lists.includes(list) ? list : 'general';

  async function toggle(participantId: string, field: LogisticsField, value: boolean) {
    setLogisticsError(null);
    const result = await patchJson(`/api/temple-participants/${participantId}/logistics`, { [field]: value });
    if (!result.ok) {
      setLogisticsError(t('logisticsError'));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: participantsKey(trip.id) });
  }

  const tripDate = new Date(`${trip.date}T00:00:00Z`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const unitName = config?.unitName ?? '';

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen — no se imprime */}
      <section className="no-print flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('filter.label')}>
          {([false, true] as const).map((value) => (
            <Button
              key={String(value)}
              role="tab"
              aria-selected={includeAll === value}
              variant={includeAll === value ? 'secondary' : 'link'}
              onClick={() => setIncludeAll(value)}
            >
              {value ? t('filter.all') : t('filter.approvedOnly')}
            </Button>
          ))}
        </div>

        {cards.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.service} className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm text-text-muted">{tServices(card.service)}</div>
                <div className="text-lg font-semibold text-text">{card.quota === null ? String(card.count) : t('ofQuota', { n: card.count, quota: card.quota })}</div>
              </div>
            ))}
          </div>
        )}

        <div className="min-w-0 overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <caption className="px-3 pt-3 text-left font-medium text-text">{t('ordinances.title')}</caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('ordinances.ordinance')}</th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{tGenders('male')}</th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{tGenders('female')}</th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('ordinances.total')}</th>
              </tr>
            </thead>
            <tbody>
              {ordinanceRows.map((row) => (
                <tr key={row.ordinance} className="even:bg-surface-muted">
                  <td className="px-3 py-2 text-text">{tOrdinances(row.ordinance)}</td>
                  <td className="px-3 py-2 text-text-muted">{t('ofQuota', { n: row.men, quota: row.quotaMen })}</td>
                  <td className="px-3 py-2 text-text-muted">{t('ofQuota', { n: row.women, quota: row.quotaWomen })}</td>
                  <td className="px-3 py-2 text-text">{t('ofQuota', { n: row.total, quota: row.quotaTotal })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-sm text-text-muted">{t('estimatedCost.label')}</div>
          <div className="text-lg font-semibold text-text">{money(estimatedCost, locale)}</div>
          <p className="mt-1 text-xs text-text-muted">{t('estimatedCost.note')}</p>
        </div>

        <Alert tone="info" title={t('dataNotice')} />

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3" role="tablist" aria-label={t('lists.label')}>
          {lists.map((kind) => (
            <Button key={kind} role="tab" aria-selected={activeList === kind} variant={activeList === kind ? 'secondary' : 'link'} onClick={() => setList(kind)}>
              {t(`lists.${kind}`)}
            </Button>
          ))}
          <Button className="ml-auto" onClick={() => window.print()}>
            {t('print')}
          </Button>
        </div>

        {logisticsError && <Alert tone="danger" role="alert" title={logisticsError} />}
      </section>

      {/* Área imprimible — lo único que sale en papel */}
      <section className="print-area flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold text-text">{t('printedHeader', { list: t(`lists.${activeList}`) })}</h3>
          <p className="text-sm text-text-muted">{t('printedMeta', { date: tripDate, unit: unitName })}</p>
        </header>

        {approved.length === 0 ? (
          <p className="text-sm text-text-muted">{t('noneApproved')}</p>
        ) : activeList === 'general' ? (
          <GeneralList participants={approved} trip={trip} locale={locale} />
        ) : activeList === 'transport' ? (
          <LogisticsList
            participants={approved.filter((p) => p.wantsTransport)}
            columns={[
              { field: 'boardedOutbound', label: t('columns.outbound') },
              { field: 'boardedReturn', label: t('columns.return') },
            ]}
            withPhone
            canUpdate={canUpdate}
            onToggle={toggle}
          />
        ) : activeList === 'breakfast' ? (
          <LogisticsList participants={approved.filter((p) => p.wantsBreakfast)} columns={[{ field: 'breakfastDelivered', label: t('columns.delivered') }]} canUpdate={canUpdate} onToggle={toggle} />
        ) : activeList === 'lunch' ? (
          <LogisticsList participants={approved.filter((p) => p.wantsLunch)} columns={[{ field: 'lunchDelivered', label: t('columns.delivered') }]} canUpdate={canUpdate} onToggle={toggle} />
        ) : activeList === 'lodging' ? (
          <LodgingList rooms={rooms?.rooms ?? []} unassigned={rooms?.unassigned ?? []} />
        ) : (
          <OrdinancesList participants={approved} locale={locale} />
        )}
      </section>
    </div>
  );
}

function ListTable({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function GeneralList({ participants, trip, locale }: { participants: ParticipantListItem[]; trip: TempleTripListItem; locale: string }) {
  const t = useTranslations('templeTrips.reports');
  const tOrdinances = useTranslations('templeTrips.quotas.ordinances');
  const tServices = useTranslations('templeTrips.public.wants');
  const services = (['transport', 'lodging', 'breakfast', 'lunch'] as const).filter((s) =>
    s === 'transport' ? trip.includesTransport : s === 'lodging' ? trip.includesLodging : s === 'breakfast' ? trip.includesBreakfast : trip.includesLunch,
  );
  const wants = (p: ParticipantListItem, s: (typeof services)[number]) =>
    s === 'transport' ? p.wantsTransport : s === 'lodging' ? p.needsLodging : s === 'breakfast' ? p.wantsBreakfast : p.wantsLunch;
  const total = participants.reduce((sum, p) => sum + Number(p.totalCost), 0);
  return (
    <ListTable
      head={
        <tr>
          <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.number')}</th>
          <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.name')}</th>
          {ORDINANCES.map((ordinance) => (
            <th key={ordinance} scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{tOrdinances(ordinance)}</th>
          ))}
          {services.map((service) => (
            <th key={service} scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{tServices(service)}</th>
          ))}
          <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.cost')}</th>
        </tr>
      }
    >
      {participants.map((p, index) => (
        <tr key={p.id} className="even:bg-surface-muted">
          <td className="px-3 py-2 text-text-muted">{index + 1}</td>
          <td className="px-3 py-2 text-text">{p.fullName}</td>
          {ORDINANCES.map((ordinance) => (
            <td key={ordinance} className="px-3 py-2 text-text">{p.ordinances.includes(ordinance) ? t('mark') : ''}</td>
          ))}
          {services.map((service) => (
            <td key={service} className="px-3 py-2 text-text">{wants(p, service) ? t('mark') : ''}</td>
          ))}
          <td className="px-3 py-2 text-text">{money(Number(p.totalCost), locale)}</td>
        </tr>
      ))}
      <tr className="border-t border-border-strong font-semibold">
        <td className="px-3 py-2 text-text" colSpan={2 + ORDINANCES.length + services.length}>{t('columns.total')}</td>
        <td className="px-3 py-2 text-text">{money(total, locale)}</td>
      </tr>
    </ListTable>
  );
}

function LogisticsList({
  participants,
  columns,
  withPhone = false,
  canUpdate,
  onToggle,
}: {
  participants: ParticipantListItem[];
  columns: { field: LogisticsField; label: string }[];
  withPhone?: boolean;
  canUpdate: boolean;
  onToggle: (participantId: string, field: LogisticsField, value: boolean) => Promise<void>;
}) {
  const t = useTranslations('templeTrips.reports');
  return (
    <ListTable
      head={
        <tr>
          <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.number')}</th>
          <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.name')}</th>
          {withPhone && <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.phone')}</th>}
          {columns.map((column) => (
            <th key={column.field} scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{column.label}</th>
          ))}
        </tr>
      }
    >
      {participants.map((p, index) => (
        <tr key={p.id} className="even:bg-surface-muted">
          <td className="px-3 py-2 text-text-muted">{index + 1}</td>
          <td className="px-3 py-2 text-text">{p.fullName}</td>
          {withPhone && <td className="px-3 py-2 text-text-muted">{p.phone}</td>}
          {columns.map((column) => (
            <td key={column.field} className="px-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label={t('checkboxFor', { label: column.label, name: p.fullName })}
                checked={p[column.field]}
                disabled={!canUpdate}
                onChange={(event) => void onToggle(p.id, column.field, event.target.checked)}
              />
            </td>
          ))}
        </tr>
      ))}
    </ListTable>
  );
}

function LodgingList({ rooms, unassigned }: { rooms: { id: string; number: string; occupants: RoomOccupant[] }[]; unassigned: RoomOccupant[] }) {
  const t = useTranslations('templeTrips.reports');
  const sorted = [...rooms].sort((a, b) => compareNatural(a.number, b.number));
  const roomTable = (title: string, occupants: RoomOccupant[], withRole: boolean) => (
    <ListTable
      head={
        <tr>
          <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted" colSpan={withRole ? 3 : 2}>{title}</th>
        </tr>
      }
    >
      {occupants.length === 0 ? (
        <tr>
          <td className="px-3 py-2 text-text-muted" colSpan={withRole ? 3 : 2}>{t('empty')}</td>
        </tr>
      ) : (
        occupants.map((occupant, index) => (
          <tr key={occupant.id} className="even:bg-surface-muted">
            <td className="px-3 py-2 text-text-muted">{index + 1}</td>
            <td className="px-3 py-2 text-text">{occupant.fullName}</td>
            {withRole && <td className="px-3 py-2 text-text-muted">{occupant.roomRole ? t(`roles.${occupant.roomRole}`) : ''}</td>}
          </tr>
        ))
      )}
    </ListTable>
  );
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((room) => roomTable(t('room', { number: room.number }), room.occupants, true))}
      {roomTable(t('unassigned'), unassigned, false)}
    </div>
  );
}

function OrdinancesList({ participants, locale }: { participants: ParticipantListItem[]; locale: string }) {
  const t = useTranslations('templeTrips.reports');
  const tOrdinances = useTranslations('templeTrips.quotas.ordinances');
  const tGenders = useTranslations('templeTrips.quotas.genders');
  const genderOrder = (gender: string) => GENDERS.indexOf(gender as Gender);
  return (
    <div className="flex flex-col gap-3">
      {ORDINANCES.map((ordinance) => {
        const people = participants
          .filter((p) => p.ordinances.includes(ordinance))
          .sort((a, b) => genderOrder(a.gender) - genderOrder(b.gender) || a.fullName.localeCompare(b.fullName, locale));
        return (
          <ListTable
            key={ordinance}
            head={
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted" colSpan={3}>{tOrdinances(ordinance)}</th>
              </tr>
            }
          >
            {people.length === 0 ? (
              <tr>
                <td className="px-3 py-2 text-text-muted" colSpan={3}>{t('empty')}</td>
              </tr>
            ) : (
              people.map((p, index) => (
                <tr key={p.id} className="even:bg-surface-muted">
                  <td className="px-3 py-2 text-text-muted">{index + 1}</td>
                  <td className="px-3 py-2 text-text">{p.fullName}</td>
                  <td className="px-3 py-2 text-text-muted">{tGenders(p.gender as Gender)}</td>
                </tr>
              ))
            )}
          </ListTable>
        );
      })}
    </div>
  );
}
