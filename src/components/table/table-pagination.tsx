'use client';

import { useTranslations } from 'next-intl';
import type { TableApi } from '@/lib/table/use-table-controls';

const BUTTON =
  'rounded-sm border border-border-strong px-3 py-1 text-sm font-medium text-text hover:border-primary hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:border-border disabled:bg-surface-muted disabled:text-text-muted';

export function TablePagination({
  table,
}: {
  table: Pick<TableApi, 'page' | 'pageCount' | 'total' | 'rangeFrom' | 'rangeTo' | 'prevPage' | 'nextPage'>;
}) {
  const t = useTranslations('table');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-text-muted">
      <p role="status">{t('range', { from: table.rangeFrom, to: table.rangeTo, total: table.total })}</p>
      <nav aria-label={t('pagination')} className="flex items-center gap-2">
        <button type="button" onClick={table.prevPage} disabled={table.page <= 1} className={BUTTON}>
          {t('previous')}
        </button>
        <span
          aria-current="page"
          aria-label={t('currentPage', { page: table.page, count: table.pageCount })}
          className="rounded-sm bg-primary px-3 py-1 font-medium text-on-primary"
        >
          {table.page}
        </span>
        <span aria-hidden="true">{t('pageOf', { count: table.pageCount })}</span>
        <button type="button" onClick={table.nextPage} disabled={table.page >= table.pageCount} className={BUTTON}>
          {t('next')}
        </button>
      </nav>
    </div>
  );
}
