'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
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

// Rejilla de solo lectura para las listas imprimibles y el resumen. A propósito NO es un elemento
// de tabla HTML: esas listas se imprimen enteras, no se ordenan ni paginan (la regla del repo exige
// que toda tabla HTML lleve los controles de #7). role="table" + display:contents da la semántica.
function Grid({ columns, rows, minWidthPx = 480 }: { columns: string[]; rows: ReactNode[][]; minWidthPx?: number }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-md border border-border bg-surface">
      <div role="table" className="grid text-sm" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(max-content, auto))`, minWidth: `${minWidthPx}px` }}>
        <div role="row" className="contents">
          {columns.map((label, index) => (
            <div key={index} role="columnheader" className="border-b border-border px-3 py-2 text-left font-medium text-text-muted">
              {label}
            </div>
          ))}
        </div>
        {rows.map((cells, rowIndex) => (
          <div key={rowIndex} role="row" className="contents">
            {cells.map((cell, cellIndex) => (
              <div key={cellIndex} role="cell" className="border-b border-border px-3 py-2 text-text">
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsPanel({ trip, canUpdate }: { trip: TempleTripListItem; canUpdate: boolean }) {
  const t = useTranslations('templeTrips.reports');
  const tOrdinances = useTranslations('templeTrips.quotas.ordinances');
  const tGenders = useTranslations('templeTrips.quotas.genders');
  const tServices = useTranslations('templeTrips.public.wants');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: participants = [] } = useQuery({ queryKey: participantsKey(trip.id), queryFn: () => fetchParticipants(trip.id) });
  const { data: rooms } = useQuery({ queryKey: roomsKey(trip.id), queryFn: () => fetchRooms(trip.id), enabled: trip.includesLodging });

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
    if (service === 'transport') return { service, count: summary.filter((p) => p.wantsTransport).length, quota: trip.quotaTransport as number | null };
    if (service === 'lodging') return { service, count: summary.filter((p) => p.needsLodging).length, quota: trip.quotaLodging as number | null };
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

  const lists = (['general', 'transport', 'breakfast', 'lunch', ...(trip.includesLodging ? (['lodging'] as const) : []), 'ordinances'] as const).filter((kind) =>
    kind === 'transport' ? trip.includesTransport : kind === 'breakfast' ? trip.includesBreakfast : kind === 'lunch' ? trip.includesLunch : true,
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
            <Button key={String(value)} role="tab" aria-selected={includeAll === value} variant={includeAll === value ? 'secondary' : 'link'} onClick={() => setIncludeAll(value)}>
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

        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm font-medium text-text">{t('ordinances.title')}</h4>
          <Grid
            columns={[t('ordinances.ordinance'), tGenders('male'), tGenders('female'), t('ordinances.total')]}
            rows={ordinanceRows.map((row) => [
              tOrdinances(row.ordinance),
              t('ofQuota', { n: row.men, quota: row.quotaMen }),
              t('ofQuota', { n: row.women, quota: row.quotaWomen }),
              t('ofQuota', { n: row.total, quota: row.quotaTotal }),
            ])}
          />
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
  const columns = [t('columns.number'), t('columns.name'), ...ORDINANCES.map((o) => tOrdinances(o)), ...services.map((s) => tServices(s)), t('columns.cost')];
  const rows: ReactNode[][] = participants.map((p, index) => [
    index + 1,
    p.fullName,
    ...ORDINANCES.map((ordinance) => (p.ordinances.includes(ordinance) ? t('mark') : '')),
    ...services.map((service) => (wants(p, service) ? t('mark') : '')),
    money(Number(p.totalCost), locale),
  ]);
  return (
    <div className="flex flex-col gap-1.5">
      <Grid columns={columns} rows={rows} />
      <p className="text-right text-sm font-semibold text-text">{t('totalLine', { total: money(total, locale) })}</p>
    </div>
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
  const header = [t('columns.number'), t('columns.name'), ...(withPhone ? [t('columns.phone')] : []), ...columns.map((c) => c.label)];
  const rows: ReactNode[][] = participants.map((p, index) => [
    index + 1,
    p.fullName,
    ...(withPhone ? [p.phone] : []),
    ...columns.map((column) => (
      <input
        key={column.field}
        type="checkbox"
        className="size-4 accent-primary"
        aria-label={t('checkboxFor', { label: column.label, name: p.fullName })}
        checked={p[column.field]}
        disabled={!canUpdate}
        onChange={(event) => void onToggle(p.id, column.field, event.target.checked)}
      />
    )),
  ]);
  return <Grid columns={header} rows={rows} />;
}

function LodgingList({ rooms, unassigned }: { rooms: { id: string; number: string; occupants: RoomOccupant[] }[]; unassigned: RoomOccupant[] }) {
  const t = useTranslations('templeTrips.reports');
  const sorted = [...rooms].sort((a, b) => compareNatural(a.number, b.number));
  const occupantRows = (occupants: RoomOccupant[], withRole: boolean): ReactNode[][] =>
    occupants.map((occupant, index) => [index + 1, occupant.fullName, ...(withRole ? [occupant.roomRole ? t(`roles.${occupant.roomRole}`) : ''] : [])]);
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((room) => (
        <div key={room.id} className="flex flex-col gap-1.5">
          <h4 className="text-sm font-medium text-text">{t('room', { number: room.number })}</h4>
          {room.occupants.length === 0 ? (
            <p className="text-sm text-text-muted">{t('empty')}</p>
          ) : (
            <Grid columns={[t('columns.number'), t('columns.name'), t('columns.role')]} rows={occupantRows(room.occupants, true)} />
          )}
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-sm font-medium text-text">{t('unassigned')}</h4>
        {unassigned.length === 0 ? (
          <p className="text-sm text-text-muted">{t('empty')}</p>
        ) : (
          <Grid columns={[t('columns.number'), t('columns.name')]} rows={occupantRows(unassigned, false)} />
        )}
      </div>
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
          <div key={ordinance} className="flex flex-col gap-1.5">
            <h4 className="text-sm font-medium text-text">{tOrdinances(ordinance)}</h4>
            {people.length === 0 ? (
              <p className="text-sm text-text-muted">{t('empty')}</p>
            ) : (
              <Grid
                columns={[t('columns.number'), t('columns.name'), t('columns.gender')]}
                rows={people.map((p, index) => [index + 1, p.fullName, tGenders(p.gender as Gender)])}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
