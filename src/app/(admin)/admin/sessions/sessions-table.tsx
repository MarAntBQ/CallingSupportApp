'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isLocale } from '@/i18n/config';
import { postJson } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import type { SessionListItem } from '@/server/auth/sessions';

const SESSIONS_KEY = ['admin-sessions'] as const;

async function fetchSessions(): Promise<SessionListItem[]> {
  const response = await fetch('/api/sessions', { cache: 'no-store' });
  if (!response.ok) throw new Error(`sessions ${response.status}`);
  return response.json();
}

export function SessionsTable({ currentSessionId, timeZone }: { currentSessionId: string; timeZone: string }) {
  const t = useTranslations('sessions');
  const activeLocale = useLocale();
  const locale = isLocale(activeLocale) ? activeLocale : 'es';
  const queryClient = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: SESSIONS_KEY, queryFn: fetchSessions });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const when = useCallback((value: string) => formatDate(value, locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }), [locale, timeZone]);

  const sortAccessors = useMemo<SortAccessors<SessionListItem>>(
    () => ({
      name: (row) => row.name,
      email: (row) => row.email,
      createdAt: (row) => new Date(row.createdAt),
      expiresAt: (row) => new Date(row.expiresAt),
    }),
    [],
  );
  const search = useCallback((row: SessionListItem) => [row.name, row.email].join(' '), []);
  const table = useTableControls(rows, { search, defaultSortKey: 'expiresAt', defaultSortDir: 'asc', sortAccessors, locale });

  async function revoke(id: string) {
    setBusyId(id);
    setError(null);
    const result = await postJson(`/api/sessions/${id}/revoke`, {});
    setBusyId(null);
    if (!result.ok) {
      setError(t('revokeError'));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  }

  if (rows.length === 0) return <p className="text-text-muted">{t('empty')}</p>;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
      <div className="min-w-0 rounded-md border border-border bg-surface shadow-md">
        <TableToolbar table={table} />
        <TableScroll label={t('caption')}>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">{t('caption')}</caption>
            <thead>
              <tr>
                <SortHeader table={table} column="name" label={t('columns.user')} />
                <SortHeader table={table} column="email" label={t('columns.email')} />
                <SortHeader table={table} column="createdAt" label={t('columns.createdAt')} />
                <SortHeader table={table} column="expiresAt" label={t('columns.expiresAt')} />
                <th scope="col" className="px-3 py-2 text-right font-semibold text-text-muted">
                  {t('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {table.view.map((row) => {
                const isCurrent = row.id === currentSessionId;
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 text-text">{row.name}</td>
                    <td className="px-3 py-2 text-text-muted">{row.email}</td>
                    <td className="px-3 py-2 text-text-muted">{when(row.createdAt)}</td>
                    <td className="px-3 py-2 text-text-muted">{when(row.expiresAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {isCurrent ? (
                        <span className="text-xs text-text-muted">{t('thisSession')}</span>
                      ) : (
                        <Button variant="link" className="text-sm text-danger-strong" disabled={busyId === row.id} onClick={() => revoke(row.id)}>
                          {t('revoke')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
        <TablePagination table={table} />
      </div>
    </div>
  );
}
