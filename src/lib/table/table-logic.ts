export type SortDir = 'asc' | 'desc';

export type SortValue = string | number | Date | null | undefined;

export type SortAccessors<T> = Record<string, (row: T) => SortValue>;

export const PAGE_SIZES = [10, 25, 50, 100, 1000] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 10;

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function utcDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function isRealDate(year: number, month: number, day: number) {
  const date = utcDate(year, month, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseDateText(text: string, locale: string): number | null {
  if (ISO_DATE.test(text)) {
    const [year, month, day] = text.slice(0, 10).split('-').map(Number) as [number, number, number];
    const time = Date.parse(text);
    return isRealDate(year, month, day) && !Number.isNaN(time) ? time : null;
  }
  const match = SLASH_DATE.exec(text);
  if (!match) return null;
  const [first, second, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const monthFirst = locale.toLowerCase().startsWith('en');
  const day = monthFirst ? second : first;
  const month = monthFirst ? first : second;
  return isRealDate(year, month, day) ? utcDate(year, month, day).getTime() : null;
}

type Normalized = { kind: 'empty' } | { kind: 'number'; value: number } | { kind: 'text'; value: string };

export function normalizeSortValue(value: SortValue, locale = 'es'): Normalized {
  if (value === null || value === undefined) return { kind: 'empty' };
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? { kind: 'empty' } : { kind: 'number', value: time };
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? { kind: 'empty' } : { kind: 'number', value };
  }
  const text = value.trim();
  if (text === '') return { kind: 'empty' };
  const time = parseDateText(text, locale);
  if (time !== null) return { kind: 'number', value: time };
  return { kind: 'text', value: text.toLowerCase() };
}

export function compareSortValues(a: SortValue, b: SortValue, dir: SortDir, locale = 'es'): number {
  const na = normalizeSortValue(a, locale);
  const nb = normalizeSortValue(b, locale);
  if (na.kind === 'empty' || nb.kind === 'empty') {
    if (na.kind === nb.kind) return 0;
    return na.kind === 'empty' ? 1 : -1;
  }
  let result: number;
  if (na.kind === 'number' && nb.kind === 'number') {
    result = na.value === nb.value ? 0 : na.value < nb.value ? -1 : 1;
  } else if (na.kind === 'text' && nb.kind === 'text') {
    result = na.value.localeCompare(nb.value, 'es');
  } else {
    result = na.kind === 'number' ? -1 : 1;
  }
  return dir === 'asc' || result === 0 ? result : -result;
}

export function filterRows<T>(rows: readonly T[], query: string, search?: (row: T) => string): readonly T[] {
  const needle = query.trim().toLowerCase();
  if (!needle || !search) return rows;
  return rows.filter((row) => search(row).toLowerCase().includes(needle));
}

export function sortRows<T>(
  rows: readonly T[],
  accessor: ((row: T) => SortValue) | undefined,
  dir: SortDir,
  locale = 'es',
): readonly T[] {
  if (!accessor) return rows;
  return [...rows].sort((a, b) => compareSortValues(accessor(a), accessor(b), dir, locale));
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return {
    view: rows.slice(start, start + pageSize),
    total,
    page: current,
    pageCount,
    rangeFrom: total === 0 ? 0 : start + 1,
    rangeTo: Math.min(start + pageSize, total),
  };
}

export type TableState = {
  search: string;
  sortKey: string;
  sortDir: SortDir;
  page: number;
  pageSize: PageSize;
};

export type TableAction =
  | { type: 'search'; value: string }
  | { type: 'sort'; key: string }
  | { type: 'pageSize'; value: PageSize }
  | { type: 'page'; value: number; pageCount: number };

export function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'search':
      return { ...state, search: action.value, page: 1 };
    case 'sort':
      return action.key === state.sortKey
        ? { ...state, sortDir: state.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
        : { ...state, sortKey: action.key, sortDir: 'asc', page: 1 };
    case 'pageSize':
      return { ...state, pageSize: action.value, page: 1 };
    case 'page':
      return { ...state, page: Math.min(Math.max(1, action.value), action.pageCount) };
  }
}
