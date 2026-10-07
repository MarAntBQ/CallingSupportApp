'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { isLocale } from '@/i18n/config';
import { formatDate, formatNumber } from '@/lib/format';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import { DEMO_ROWS, type DemoRow } from './demo-rows';

const COLUMNS = ['name', 'email', 'organization', 'registeredOn', 'slots'] as const;


export function TableDemo() {
  const t = useTranslations('tableDemo');
  const activeLocale = useLocale();
  const locale = isLocale(activeLocale) ? activeLocale : 'es';
  const sortAccessors = useMemo<SortAccessors<DemoRow>>(
    () => ({
      name: (row) => row.name,
      email: (row) => row.email,
      organization: (row) => (row.organization ? t(`organizations.${row.organization}`) : null),
      registeredOn: (row) => row.registeredOn,
      slots: (row) => row.slots,
    }),
    [t],
  );
  const search = useCallback(
    (row: DemoRow) => [row.name, row.email, row.organization ? t(`organizations.${row.organization}`) : ''].join(' '),
    [t],
  );
  const table = useTableControls(DEMO_ROWS, {
    search,
    defaultSortKey: 'name',
    sortAccessors,
    locale,
  });

  return (
    <section className="min-w-0 rounded-md border border-border bg-surface shadow-md">
      <TableToolbar table={table} />
      <TableScroll label={t('caption')}>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">{t('caption')}</caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <SortHeader key={column} table={table} column={column} label={t(`columns.${column}`)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {table.view.map((row) => (
              <tr key={row.id} className="even:bg-surface-muted">
                <td className="px-4 py-2 text-text">{row.name}</td>
                <td className="px-4 py-2 text-text">{row.email}</td>
                <td className="px-4 py-2 text-text">
                  {row.organization ? (
                    t(`organizations.${row.organization}`)
                  ) : (
                    <span className="text-text-muted italic">{t('empty.organization')}</span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-text">
                  {row.registeredOn ? (
                    formatDate(`${row.registeredOn}T12:00:00`, locale, { dateStyle: 'medium' })
                  ) : (
                    <span className="text-text-muted italic">{t('empty.registeredOn')}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-text tabular-nums">
                  {row.slots === null ? (
                    <span className="text-text-muted italic">{t('empty.slots')}</span>
                  ) : (
                    formatNumber(row.slots, locale)
                  )}
                </td>
              </tr>
            ))}
            {table.view.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-text-muted">
                  {t('noRows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      <TablePagination table={table} />
    </section>
  );
}
