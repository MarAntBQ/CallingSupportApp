'use client';

import type { TableApi } from '@/lib/table/use-table-controls';

export function SortHeader({
  table,
  column,
  label,
  className,
}: {
  table: Pick<TableApi, 'sortKey' | 'sortDir' | 'toggleSort'>;
  column: string;
  label: string;
  className?: string;
}) {
  const active = table.sortKey === column;
  const ariaSort = active ? (table.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th scope="col" aria-sort={ariaSort} className={`px-4 py-3 text-left text-sm font-medium text-text-muted ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => table.toggleSort(column)}
        className="inline-flex items-center gap-1 rounded-sm whitespace-nowrap select-none hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {label}
        <span aria-hidden="true" className={`text-xs ${active ? 'text-primary' : 'text-text-muted'}`}>
          {active ? (table.sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}
