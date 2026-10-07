'use client';

import { useTranslations } from 'next-intl';
import { isPageSize } from '@/lib/table/table-logic';
import type { TableApi } from '@/lib/table/use-table-controls';

export function TableToolbar({
  table,
  searchPlaceholder,
}: {
  table: Pick<TableApi, 'pageSize' | 'pageSizes' | 'setPageSize' | 'search' | 'searchable' | 'setSearch'>;
  searchPlaceholder?: string;
}) {
  const t = useTranslations('table');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-text-muted">
        {t.rich('pageSize', {
          select: () => (
            <select
              value={table.pageSize}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (isPageSize(value)) table.setPageSize(value);
              }}
              className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
            >
              {table.pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          ),
        })}
      </label>
      {table.searchable && (
        <label className="flex w-full items-center gap-2 text-sm text-text-muted sm:w-auto">
          {t('search')}
          <input
            type="search"
            value={table.search}
            onChange={(event) => table.setSearch(event.target.value)}
            placeholder={searchPlaceholder ?? t('searchPlaceholder')}
            className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary sm:w-56 sm:flex-none"
          />
        </label>
      )}
    </div>
  );
}
