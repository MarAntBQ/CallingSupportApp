import { describe, expect, it } from 'vitest';
import {
  compareSortValues,
  filterRows,
  isPageSize,
  normalizeSortValue,
  paginate,
  sortRows,
  tableReducer,
  type SortValue,
  type TableState,
} from './table-logic';

const byValue = (values: SortValue[], dir: 'asc' | 'desc') =>
  sortRows(values, (v) => v, dir);

describe('orden de las columnas', () => {
  it('los nulos y vacíos van al final en ascendente y en descendente', () => {
    const values: SortValue[] = ['b', null, 'a', '', undefined, '   ', 'c'];
    expect(byValue(values, 'asc').slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(byValue(values, 'desc').slice(0, 3)).toEqual(['c', 'b', 'a']);
    for (const dir of ['asc', 'desc'] as const) {
      expect(byValue(values, dir).slice(3).every((v) => v == null || String(v).trim() === '')).toBe(true);
    }
  });

  it('una fecha inválida o NaN cuenta como vacío', () => {
    const invalid = new Date('nada');
    for (const dir of ['asc', 'desc'] as const) {
      const sorted = byValue([invalid, 2, Number.NaN, 1], dir);
      expect(sorted.slice(0, 2)).toEqual(dir === 'asc' ? [1, 2] : [2, 1]);
      expect(sorted.slice(2)).toEqual(expect.arrayContaining([invalid, Number.NaN]));
    }
    expect(normalizeSortValue(invalid)).toEqual({ kind: 'empty' });
    expect(normalizeSortValue(Number.NaN)).toEqual({ kind: 'empty' });
  });

  it('compara los números como números, no como texto', () => {
    expect(byValue([10, 9, 100, 1], 'asc')).toEqual([1, 9, 10, 100]);
    expect(byValue([10, 9, 100, 1], 'desc')).toEqual([100, 10, 9, 1]);
  });

  it('compara los objetos Date por su momento', () => {
    const a = new Date('2026-01-05T00:00:00Z');
    const b = new Date('2025-12-31T00:00:00Z');
    expect(byValue([a, b], 'asc')).toEqual([b, a]);
  });

  it('los textos con forma de fecha ISO se comparan como fecha', () => {
    expect(byValue(['2026-02-01', '2025-12-31', '2026-01-15'], 'asc')).toEqual(['2025-12-31', '2026-01-15', '2026-02-01']);
    expect(byValue(['2026-01-15T10:00:00Z', '2026-01-15T09:00:00Z'], 'asc')).toEqual(['2026-01-15T09:00:00Z', '2026-01-15T10:00:00Z']);
  });

  it('dd/mm/aaaa en español y portugués, mm/dd/aaaa en inglés', () => {
    const values = ['15/03/2024', '02/01/2025', '1/12/2024'];
    expect(sortRows(values, (v) => v, 'asc', 'es')).toEqual(['15/03/2024', '1/12/2024', '02/01/2025']);
    expect(sortRows(values, (v) => v, 'asc', 'pt')).toEqual(['15/03/2024', '1/12/2024', '02/01/2025']);
    expect(sortRows(['03/10/2026', '12/01/2025', '01/02/2026'], (v) => v, 'asc', 'en')).toEqual(['12/01/2025', '01/02/2026', '03/10/2026']);
  });

  it('un texto con "/" o con una fecha imposible se compara como texto', () => {
    expect(byValue(['N/A', 'Calle 5/6', 'B/C'], 'asc')).toEqual(['B/C', 'Calle 5/6', 'N/A']);
    expect(compareSortValues('31/02/2026', '2026-01-01', 'asc')).toBeGreaterThan(0);
    expect(compareSortValues('2026-13-45', '2026-01-01', 'asc')).toBeGreaterThan(0);
    expect(compareSortValues('2026-02-30', '2026-12-31', 'asc')).toBeGreaterThan(0);
    expect(compareSortValues('2026-02-29T10:00:00Z', '2026-12-31', 'asc')).toBeGreaterThan(0);
    expect(compareSortValues('2028-02-29', '2028-03-01', 'asc')).toBeLessThan(0);
    expect(byValue(['texto', '0050-06-15', '1999-01-01'], 'asc')).toEqual(['0050-06-15', '1999-01-01', 'texto']);
    expect(sortRows(['texto', '15/06/0050', '01/01/1999'], (v) => v, 'asc', 'es')).toEqual(['15/06/0050', '01/01/1999', 'texto']);
  });

  it('compara el resto como texto en minúsculas con el orden del español, en cualquier idioma', () => {
    const values = ['ñandú', 'Oso', 'nube', 'Zorro', 'árbol'];
    const expected = ['árbol', 'nube', 'ñandú', 'Oso', 'Zorro'];
    for (const locale of ['es', 'pt', 'en']) expect(sortRows(values, (v) => v, 'asc', locale)).toEqual(expected);
  });

  it('con tipos mezclados, los números y fechas van antes que el texto', () => {
    expect(compareSortValues(5, 'texto', 'asc')).toBeLessThan(0);
    expect(compareSortValues('texto', 5, 'asc')).toBeGreaterThan(0);
  });

  it('el descendente es el inverso exacto del ascendente para valores no vacíos', () => {
    expect(compareSortValues('a', 'b', 'desc')).toBeGreaterThan(0);
    expect(compareSortValues(1, 1, 'desc')).toBe(0);
  });

  it('sin accessor deja las filas en su orden original', () => {
    const rows = [3, 1, 2];
    expect(sortRows(rows, undefined, 'asc')).toBe(rows);
  });

  it('no modifica el arreglo recibido', () => {
    const rows = [3, 1, 2];
    sortRows(rows, (v) => v, 'asc');
    expect(rows).toEqual([3, 1, 2]);
  });
});

describe('búsqueda', () => {
  const rows = ['Ana Prueba', 'Beto Ejemplo', 'ANABEL Demo'];

  it('busca por subcadena sin distinguir mayúsculas', () => {
    expect(filterRows(rows, 'ana', (r) => r)).toEqual(['Ana Prueba', 'ANABEL Demo']);
    expect(filterRows(rows, '  EJEM ', (r) => r)).toEqual(['Beto Ejemplo']);
  });

  it('sin texto o sin función de búsqueda devuelve todas las filas', () => {
    expect(filterRows(rows, '   ', (r) => r)).toBe(rows);
    expect(filterRows(rows, 'ana')).toBe(rows);
  });
});

describe('paginación', () => {
  const rows = Array.from({ length: 30 }, (_, i) => i + 1);

  it('corta la página pedida y calcula el rango', () => {
    expect(paginate(rows, 2, 10)).toMatchObject({ view: rows.slice(10, 20), total: 30, page: 2, pageCount: 3, rangeFrom: 11, rangeTo: 20 });
    expect(paginate(rows, 3, 25)).toMatchObject({ page: 2, pageCount: 2, rangeFrom: 26, rangeTo: 30 });
  });

  it('sin filas muestra 0 a 0 y una sola página', () => {
    expect(paginate([], 1, 10)).toMatchObject({ view: [], total: 0, page: 1, pageCount: 1, rangeFrom: 0, rangeTo: 0 });
  });

  it('una página fuera de rango se ajusta a la última o a la primera', () => {
    expect(paginate(rows, 9, 10).page).toBe(3);
    expect(paginate(rows, 0, 10).page).toBe(1);
  });

  it('solo acepta los tamaños 10, 25, 50, 100 y 1000', () => {
    expect([10, 25, 50, 100, 1000].every(isPageSize)).toBe(true);
    expect(isPageSize(20)).toBe(false);
  });
});

describe('estado de la tabla', () => {
  const base: TableState = { search: '', sortKey: 'name', sortDir: 'asc', page: 3, pageSize: 10 };

  it('clic en la columna activa alterna asc/desc', () => {
    const once = tableReducer(base, { type: 'sort', key: 'name' });
    expect(once.sortDir).toBe('desc');
    expect(tableReducer(once, { type: 'sort', key: 'name' }).sortDir).toBe('asc');
  });

  it('clic en otra columna ordena asc y vuelve a la página 1', () => {
    const next = tableReducer({ ...base, sortDir: 'desc' }, { type: 'sort', key: 'date' });
    expect(next).toMatchObject({ sortKey: 'date', sortDir: 'asc', page: 1 });
  });

  it('buscar vuelve a la página 1', () => {
    expect(tableReducer(base, { type: 'search', value: 'ana' })).toMatchObject({ search: 'ana', page: 1 });
  });

  it('cambiar el tamaño de página vuelve a la página 1', () => {
    expect(tableReducer(base, { type: 'pageSize', value: 25 })).toMatchObject({ pageSize: 25, page: 1 });
  });

  it('moverse de página no pasa de los límites', () => {
    expect(tableReducer(base, { type: 'page', value: 4, pageCount: 3 }).page).toBe(3);
    expect(tableReducer(base, { type: 'page', value: 0, pageCount: 3 }).page).toBe(1);
    expect(tableReducer(base, { type: 'page', value: 2, pageCount: 3 }).page).toBe(2);
  });
});
