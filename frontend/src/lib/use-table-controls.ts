import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

interface Options<T> {
  // Campos por los que se busca (string getter por fila).
  search?: (row: T) => string;
  // Orden por defecto.
  defaultSortKey: string;
  defaultSortDir?: SortDir;
  // Getter del valor a ordenar por clave de columna.
  sortAccessors: Record<string, (row: T) => string | number | Date | null | undefined>;
  pageSize?: number;
}

const PAGE_SIZES = [10, 25, 50, 100, 1000];

// Controles de tabla estilo estándar del sector (DataTables): búsqueda + ordenamiento + paginación.
// El orden por defecto se aplica con defaultSortKey/defaultSortDir.
export function useTableControls<T>(rows: T[], opts: Options<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(opts.defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(opts.defaultSortDir ?? 'asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts.pageSize ?? 10);

  const toggleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !opts.search) return rows;
    return rows.filter((r) => opts.search!(r).toLowerCase().includes(q));
  }, [rows, search, opts]);

  const sorted = useMemo(() => {
    const accessor = opts.sortAccessors[sortKey];
    if (!accessor) return filtered;
    const norm = (v: unknown): number | string => {
      if (v == null) return sortDir === 'asc' ? Infinity : -Infinity;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
      const d = Date.parse(String(v));
      if (!Number.isNaN(d) && /\d{4}-\d{2}-\d{2}|\//.test(String(v))) return d;
      return String(v).toLowerCase();
    };
    return [...filtered].sort((a, b) => {
      const va = norm(accessor(a));
      const vb = norm(accessor(b));
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir, opts.sortAccessors]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const view = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  return {
    view,
    total,
    page: safePage,
    pageCount,
    pageSize,
    setPageSize: (n: number) => { setPageSize(n); setPage(1); },
    nextPage: () => setPage((p) => Math.min(p + 1, pageCount)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1); },
    sortKey,
    sortDir,
    toggleSort,
    pageSizes: PAGE_SIZES,
    rangeFrom: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeTo: Math.min(safePage * pageSize, total),
  };
}
