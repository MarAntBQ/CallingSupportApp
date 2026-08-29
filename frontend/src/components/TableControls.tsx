import type { SortDir } from '../lib/use-table-controls';

interface TableApi {
  search: string;
  setSearch: (s: string) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  pageSizes: number[];
  sortKey: string;
  sortDir: SortDir;
  toggleSort: (key: string) => void;
  page: number;
  pageCount: number;
  nextPage: () => void;
  prevPage: () => void;
  total: number;
  rangeFrom: number;
  rangeTo: number;
}

// Barra superior: buscador + "Mostrar N" (estilo estándar del sector DataTables).
export function TableToolbar({ table, placeholder }: { table: TableApi; placeholder?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
      <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        Mostrar
        <select
          value={table.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--sage-600)]"
        >
          {table.pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        registros
      </label>
      <input
        value={table.search}
        onChange={(e) => table.setSearch(e.target.value)}
        placeholder={placeholder ?? 'Buscar…'}
        className="w-56 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
      />
    </div>
  );
}

// Encabezado ordenable: click alterna asc/desc; muestra el indicador en la columna activa.
export function SortHeader({
  table,
  colKey,
  label,
  className = 'px-4 py-3',
}: {
  table: TableApi;
  colKey: string;
  label: string;
  className?: string;
}) {
  const active = table.sortKey === colKey;
  return (
    <th
      onClick={() => table.toggleSort(colKey)}
      className={`cursor-pointer select-none hover:text-[var(--brown-700)] ${className}`}
    >
      {label}
      <span className={`ml-1 inline-block text-[10px] ${active ? 'text-[var(--brown-700)]' : 'text-[var(--border)]'}`}>
        {active ? (table.sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

// Pie: "Mostrando X a Y de Z" + Anterior/Siguiente.
export function TablePagination({ table }: { table: TableApi }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
      <span>
        Mostrando {table.rangeFrom} a {table.rangeTo} de {table.total} registros
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={table.prevPage}
          disabled={table.page <= 1}
          className="rounded border border-[var(--border)] px-3 py-1 font-medium hover:bg-[var(--bg)] disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="rounded bg-[var(--brown-700)] px-3 py-1 font-medium text-white">{table.page}</span>
        <span className="px-1">de {table.pageCount}</span>
        <button
          type="button"
          onClick={table.nextPage}
          disabled={table.page >= table.pageCount}
          className="rounded border border-[var(--border)] px-3 py-1 font-medium hover:bg-[var(--bg)] disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
