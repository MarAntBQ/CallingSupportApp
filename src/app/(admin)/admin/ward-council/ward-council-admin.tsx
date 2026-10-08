'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import type { WardCouncilGroup } from '@/server/users/users';

type Row = { key: string; orgName: string; calling: string; userId: string | null; name: string; email: string };

export function WardCouncilAdmin({ groups }: { groups: WardCouncilGroup[] }) {
  const t = useTranslations('wardCouncil');
  const locale = useLocale();

  // Una fila por líder; una organización sin líderes aparece con el estado vacío.
  const rows = useMemo<Row[]>(
    () =>
      groups.flatMap((group): Row[] =>
        group.leaders.length > 0
          ? group.leaders.map((leader) => ({ key: `${group.organization.id}:${leader.id}:${leader.calling}`, orgName: group.organization.name, calling: leader.calling, userId: leader.id, name: leader.name, email: leader.email }))
          : [{ key: group.organization.id, orgName: group.organization.name, calling: '', userId: null, name: '', email: '' }],
      ),
    [groups],
  );

  const search = (row: Row) => `${row.orgName} ${row.calling} ${row.name} ${row.email}`;
  const sortAccessors = useMemo<SortAccessors<Row>>(() => ({ organization: (row) => row.orgName, name: (row) => row.name }), []);
  const table = useTableControls(rows, { search, defaultSortKey: 'organization', sortAccessors, locale });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="min-w-0 rounded-md border border-border bg-surface">
          <TableToolbar table={table} />
          <TableScroll label={t('title')}>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <SortHeader table={table} column="organization" label={t('columns.organization')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.calling')}</th>
                  <SortHeader table={table} column="name" label={t('columns.name')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.email')}</th>
                </tr>
              </thead>
              <tbody>
                {table.view.map((row) => (
                  <tr key={row.key} className="even:bg-surface-muted">
                    <td className="px-3 py-2 text-text">{row.orgName}</td>
                    {row.userId ? (
                      <>
                        <td className="px-3 py-2 text-text-muted">{row.calling}</td>
                        <td className="px-3 py-2">
                          <Link href={`/admin/users?edit=${row.userId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-text-muted">{row.email}</td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-text-muted" colSpan={3}>{t('noLeader')}</td>
                    )}
                  </tr>
                ))}
                {table.view.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-text-muted">{t('noRows')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
          <TablePagination table={table} />
        </div>
      )}
    </section>
  );
}
