'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { Alert } from '@/components/ui/alert';
import { putJson } from '@/lib/api-client';
import { MODULES, type ModuleKey } from '@/lib/modules';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import {
  PERMISSION_FLAGS,
  type MatrixRow,
  type PermissionFlag,
  type PermissionMatrix,
} from '@/lib/validation/module-permissions';
import { Card } from '../settings/card';

export const MATRIX_KEY = ['module-permissions'] as const;

async function fetchMatrix(): Promise<PermissionMatrix> {
  const response = await fetch('/api/module-permissions', { cache: 'no-store' });
  if (!response.ok) throw new Error(`module-permissions ${response.status}`);
  return response.json();
}

function putModule(module: ModuleKey, rows: MatrixRow[]) {
  const permissions = rows.map(({ callingId, canRead, canCreate, canUpdate, canDelete, canNotify }) => ({
    callingId,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canNotify,
  }));
  return putJson<MatrixRow[]>(`/api/module-permissions/${module}`, { permissions });
}

const granted = (row: MatrixRow) => PERMISSION_FLAGS.some((flag) => row[flag]);

export function PermissionsSection({ initialMatrix, canUpdate }: { initialMatrix: PermissionMatrix; canUpdate: boolean }) {
  const t = useTranslations('organizations.permissions');
  const { data: matrix = initialMatrix } = useQuery({ queryKey: MATRIX_KEY, queryFn: fetchMatrix, initialData: initialMatrix });
  const anyActive = MODULES.some((module) => matrix[module].some((row) => row.active));

  return (
    <Card title={t('title')} intro={t('intro')}>
      {!canUpdate && <Alert tone="info" role="status" title={t('readOnly')} />}
      {!anyActive ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {MODULES.map((module) => (
            <ModulePermissions key={module} module={module} rows={matrix[module]} canUpdate={canUpdate} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ModulePermissions({ module, rows, canUpdate }: { module: ModuleKey; rows: MatrixRow[]; canUpdate: boolean }) {
  const t = useTranslations('organizations.permissions');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{ ok: true } | { ok: false; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const latest = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const active = useMemo(() => rows.filter((row) => row.active), [rows]);
  const moduleName = t(`modules.${module}`);

  const sortAccessors = useMemo<SortAccessors<MatrixRow>>(
    () => ({ organization: (row) => row.organizationName, calling: (row) => row.callingName }),
    [],
  );
  const search = useCallback((row: MatrixRow) => `${row.organizationName} ${row.callingName}`, []);
  const table = useTableControls(active, { search, defaultSortKey: 'organization', sortAccessors, locale });

  function toggle(callingId: string, flag: PermissionFlag, value: boolean) {
    const previous = queryClient.getQueryData<PermissionMatrix>(MATRIX_KEY);
    if (!previous) return;
    const next = previous[module].map((row) => (row.callingId === callingId ? { ...row, [flag]: value } : row));
    queryClient.setQueryData<PermissionMatrix>(MATRIX_KEY, { ...previous, [module]: next });
    const request = ++latest.current;
    setSaving(true);
    setStatus(null);
    queue.current = queue.current.then(async () => {
      const current = queryClient.getQueryData<PermissionMatrix>(MATRIX_KEY)?.[module] ?? next;
      const result = await putModule(module, current);
      if (!result.ok) {
        const unknownCalling = result.issues.some((issue) => issue.code === 'unknown_calling');
        setStatus({ ok: false, message: unknownCalling ? t('unknownCalling') : tErrors(result.error) });
        await queryClient.invalidateQueries({ queryKey: MATRIX_KEY });
      } else if (request === latest.current) {
        setStatus({ ok: true });
      }
      if (request === latest.current) setSaving(false);
    });
  }

  return (
    <details className="rounded-md border border-border" data-module={module}>
      <summary className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-base font-medium text-text">
        <span>{moduleName}</span>
        <span className="text-sm font-normal text-text-muted">
          {t('summary', { granted: active.filter(granted).length, total: active.length })}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <div aria-live="polite" className="min-h-6 text-sm">
          {saving ? (
            <span className="text-text-muted">{t('saving')}</span>
          ) : status?.ok ? (
            <span className="text-success-strong">{t('saved')}</span>
          ) : null}
        </div>
        {status && !status.ok && <Alert tone="danger" role="alert" title={status.message} />}
        <div className="min-w-0 rounded-md border border-border bg-surface">
          <TableToolbar table={table} />
          <TableScroll label={t('caption', { module: moduleName })}>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">{t('caption', { module: moduleName })}</caption>
              <thead>
                <tr>
                  <SortHeader table={table} column="organization" label={t('columns.organization')} />
                  <SortHeader table={table} column="calling" label={t('columns.calling')} />
                  {PERMISSION_FLAGS.map((flag) => (
                    <th key={flag} scope="col" className="px-3 py-2 text-center font-medium text-text-muted">
                      {t(`columns.${flag}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.view.map((row) => (
                  <tr key={row.callingId} className="even:bg-surface-muted">
                    <td className="px-4 py-2 text-text">{row.organizationName}</td>
                    <td className="px-4 py-2 text-text">{row.callingName}</td>
                    {PERMISSION_FLAGS.map((flag) => (
                      <td key={flag} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={row[flag]}
                          disabled={!canUpdate}
                          aria-label={t('checkbox', {
                            action: t(`columns.${flag}`),
                            calling: row.callingName,
                            organization: row.organizationName,
                          })}
                          onChange={(event) => void toggle(row.callingId, flag, event.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {table.view.length === 0 && (
                  <tr>
                    <td colSpan={2 + PERMISSION_FLAGS.length} className="px-4 py-6 text-center text-text-muted">
                      {t('noRows')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
          <TablePagination table={table} />
        </div>
      </div>
    </details>
  );
}
