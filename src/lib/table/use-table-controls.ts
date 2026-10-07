import { useMemo, useReducer } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  filterRows,
  paginate,
  PAGE_SIZES,
  sortRows,
  tableReducer,
  type PageSize,
  type SortAccessors,
  type SortDir,
} from './table-logic';

export type TableControlsOptions<T> = {
  search?: (row: T) => string;
  defaultSortKey: string;
  defaultSortDir?: SortDir;
  sortAccessors: SortAccessors<T>;
  pageSize?: PageSize;
  locale?: string;
};

export type TableControls<T> = ReturnType<typeof useTableControls<T>>;

export type TableApi = Omit<TableControls<unknown>, 'view'>;

export function useTableControls<T>(rows: readonly T[], options: TableControlsOptions<T>) {
  const { search: searchText, sortAccessors, locale } = options;
  const [state, dispatch] = useReducer(tableReducer, {
    search: '',
    sortKey: options.defaultSortKey,
    sortDir: options.defaultSortDir ?? 'asc',
    page: 1,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
  });

  const filtered = useMemo(() => filterRows(rows, state.search, searchText), [rows, state.search, searchText]);
  const sorted = useMemo(
    () => sortRows(filtered, sortAccessors[state.sortKey], state.sortDir, locale),
    [filtered, sortAccessors, state.sortKey, state.sortDir, locale],
  );
  const result = useMemo(() => paginate(sorted, state.page, state.pageSize), [sorted, state.page, state.pageSize]);

  return {
    ...result,
    search: state.search,
    searchable: Boolean(searchText),
    sortKey: state.sortKey,
    sortDir: state.sortDir,
    pageSize: state.pageSize,
    pageSizes: PAGE_SIZES,
    setSearch: (value: string) => dispatch({ type: 'search', value }),
    toggleSort: (key: string) => dispatch({ type: 'sort', key }),
    setPageSize: (value: PageSize) => dispatch({ type: 'pageSize', value }),
    prevPage: () => dispatch({ type: 'page', value: result.page - 1, pageCount: result.pageCount }),
    nextPage: () => dispatch({ type: 'page', value: result.page + 1, pageCount: result.pageCount }),
  };
}
