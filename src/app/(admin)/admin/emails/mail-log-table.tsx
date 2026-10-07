'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { isLocale } from '@/i18n/config';
import { knownMailError } from '@/lib/mail-errors';
import { formatDate } from '@/lib/format';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';

export type MailLogRow = {
  id: string;
  createdAt: string;
  source: string;
  to: string;
  subject: string;
  success: boolean;
  error: string | null;
};

export function MailLogTable({ rows, timeZone }: { rows: MailLogRow[]; timeZone: string }) {
  const t = useTranslations('mailLogs');
  const tSmtp = useTranslations('settings.smtp');
  const activeLocale = useLocale();
  const locale = isLocale(activeLocale) ? activeLocale : 'es';
  const status = useCallback((row: MailLogRow) => (row.success ? t('sent') : t('failed')), [t]);
  const sortAccessors = useMemo<SortAccessors<MailLogRow>>(
    () => ({
      createdAt: (row) => new Date(row.createdAt),
      source: (row) => row.source,
      to: (row) => row.to,
      subject: (row) => row.subject,
      status: (row) => status(row),
    }),
    [status],
  );
  const search = useCallback((row: MailLogRow) => [row.source, row.to, row.subject, status(row)].join(' '), [status]);
  const table = useTableControls(rows, { search, defaultSortKey: 'createdAt', defaultSortDir: 'desc', sortAccessors, locale });
  const errorText = (error: string | null) => {
    const known = knownMailError(error);
    return known ? tSmtp(`mailErrors.${known}`) : (error ?? '');
  };

  if (rows.length === 0) return <p className="text-text-muted">{t('empty')}</p>;

  return (
    <div className="min-w-0 rounded-md border border-border bg-surface shadow-md">
      <TableToolbar table={table} />
      <TableScroll label={t('caption')}>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">{t('caption')}</caption>
          <thead>
            <tr>
              <SortHeader table={table} column="createdAt" label={t('columns.date')} />
              <SortHeader table={table} column="source" label={t('columns.source')} />
              <SortHeader table={table} column="to" label={t('columns.to')} />
              <SortHeader table={table} column="subject" label={t('columns.subject')} />
              <SortHeader table={table} column="status" label={t('columns.status')} />
            </tr>
          </thead>
          <tbody>
            {table.view.map((row) => (
              <tr key={row.id} className="even:bg-surface-muted">
                <td className="px-4 py-2 whitespace-nowrap text-text">
                  {formatDate(row.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short', timeZone })}
                </td>
                <td className="px-4 py-2 text-text">{row.source}</td>
                <td className="px-4 py-2 break-all text-text">{row.to}</td>
                <td className="px-4 py-2 text-text">{row.subject}</td>
                <td className="px-4 py-2">
                  {row.success ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-sm text-success-strong">
                      <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                      {t('sent')}
                    </span>
                  ) : (
                    <span
                      title={errorText(row.error)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-sm text-danger-strong"
                    >
                      <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                      {t('failed')}
                      <span className="sr-only">: {errorText(row.error)}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {table.view.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-muted">
                  {t('noRows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      <TablePagination table={table} />
    </div>
  );
}
