'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { deleteJson, patchJson, postJson, type ApiResult } from '@/lib/api-client';
import {
  RESOURCE_CATEGORIES,
  RESOURCE_DESCRIPTION_MAX,
  RESOURCE_LOCALES,
  RESOURCE_TITLE_MAX,
  RESOURCE_URL_MAX,
  type ResourceCategory,
  type ResourceLocale,
} from '@/lib/self-reliance/constants';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import type { ResourceItem } from '@/lib/validation/self-reliance';

const RESOURCES_KEY = ['self-reliance', 'resources'] as const;

const SELECT =
  'w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary disabled:bg-surface-muted disabled:text-text-muted';

async function fetchResources(): Promise<ResourceItem[]> {
  const response = await fetch('/api/self-reliance/resources', { cache: 'no-store' });
  if (!response.ok) throw new Error(`self-reliance ${response.status}`);
  return response.json();
}

const byPosition = (resources: readonly ResourceItem[]) => [...resources].sort((a, b) => a.position - b.position);

export function ResourcesAdmin({
  initialResources,
  canCreate,
  canUpdate,
  canDelete,
}: {
  initialResources: ResourceItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('selfReliance');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: resources = [] } = useQuery({ queryKey: RESOURCES_KEY, queryFn: fetchResources, initialData: initialResources });
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = (resource: ResourceItem) => `${resource.title} ${resource.description ?? ''} ${resource.url} ${t(`categories.${resource.category}`)}`;
  const sortAccessors = useMemo<SortAccessors<ResourceItem>>(
    () => ({
      position: (resource) => resource.position,
      title: (resource) => resource.title,
      category: (resource) => resource.category,
    }),
    [],
  );
  const table = useTableControls(resources, { search, defaultSortKey: 'position', sortAccessors, locale });
  const refresh = () => queryClient.invalidateQueries({ queryKey: RESOURCES_KEY });
  const ordered = byPosition(resources);

  async function move(resource: ResourceItem, offset: -1 | 1) {
    const ids = ordered.map((item) => item.id);
    const from = ids.indexOf(resource.id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    setMoving(true);
    setError(null);
    const result = await postJson<ResourceItem[]>('/api/self-reliance/resources/reorder', { ids });
    setMoving(false);
    if (!result.ok) setError(result.issues.some((issue) => issue.code === 'stale') ? t('errors.stale') : tErrors(result.error));
    await refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
          <p className="text-text-muted">{t('intro')}</p>
        </div>
        {canCreate && <Button onClick={() => setCreating(true)}>{t('newResource')}</Button>}
      </div>

      <h2 className="text-xl font-semibold text-text">{t('resourcesTitle')}</h2>
      {error && <Alert tone="danger" role="alert" title={error} />}

      {resources.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="min-w-0 rounded-md border border-border bg-surface">
          <TableToolbar table={table} />
          <TableScroll label={t('resourcesTitle')}>
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <SortHeader table={table} column="position" label={t('columns.position')} />
                  <SortHeader table={table} column="title" label={t('columns.title')} />
                  <SortHeader table={table} column="category" label={t('columns.category')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.locale')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.status')}</th>
                  {canUpdate && <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.order')}</th>}
                </tr>
              </thead>
              <tbody>
                {table.view.map((resource) => {
                  const index = ordered.findIndex((item) => item.id === resource.id);
                  return (
                    <tr key={resource.id} className="even:bg-surface-muted">
                      <td className="px-3 py-2 text-text-muted">{resource.position}</td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <button type="button" className="text-left font-medium text-primary underline-offset-4 hover:underline" onClick={() => setEditing(resource)}>
                            {resource.title}
                          </button>
                          {resource.official && (
                            <span className="rounded-sm border border-primary px-1.5 py-0.5 text-xs font-medium text-primary">{t('official')}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text">{t(`categories.${resource.category}`)}</td>
                      <td className="px-3 py-2 text-text-muted">{t(`locales.${resource.locale}`)}</td>
                      <td className="px-3 py-2">{resource.published ? t('published') : t('hidden')}</td>
                      {canUpdate && (
                        <td className="px-3 py-2">
                          <span className="flex gap-1">
                            <Button variant="link" disabled={moving || index <= 0} aria-label={t('moveUp', { title: resource.title })} onClick={() => void move(resource, -1)}>
                              {t('up')}
                            </Button>
                            <Button
                              variant="link"
                              disabled={moving || index < 0 || index >= ordered.length - 1}
                              aria-label={t('moveDown', { title: resource.title })}
                              onClick={() => void move(resource, 1)}
                            >
                              {t('down')}
                            </Button>
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {table.view.length === 0 && (
                  <tr>
                    <td colSpan={canUpdate ? 6 : 5} className="px-4 py-6 text-center text-text-muted">{t('noRows')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
          <TablePagination table={table} />
        </div>
      )}

      {editing && (
        <ResourceModal
          resource={editing}
          canSave={canUpdate}
          canDelete={canDelete}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {creating && (
        <ResourceModal
          canSave={canCreate}
          canDelete={false}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

type Draft = { title: string; description: string; url: string; category: ResourceCategory; locale: ResourceLocale; published: boolean };

function ResourceModal({
  resource,
  canSave,
  canDelete,
  onClose,
  onSaved,
}: {
  resource?: ResourceItem;
  canSave: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const t = useTranslations('selfReliance');
  const tErrors = useTranslations('errors');
  const titleId = useId();
  const [draft, setDraft] = useState<Draft>({
    title: resource?.title ?? '',
    description: resource?.description ?? '',
    url: resource?.url ?? '',
    category: resource?.category ?? 'courses',
    locale: resource?.locale ?? 'all',
    published: resource?.published ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patch = (next: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...next }));

  function messageFor(result: Extract<ApiResult<unknown>, { ok: false }>) {
    if (result.error === 'invalid_input' && result.fields.includes('url')) return t('errors.url');
    if (result.error === 'invalid_input' && result.fields.includes('title')) return t('errors.title');
    return tErrors(result.error);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const body = { ...draft, title: draft.title.trim(), url: draft.url.trim(), description: draft.description.trim() };
    const result = resource ? await patchJson(`/api/self-reliance/resources/${resource.id}`, body) : await postJson('/api/self-reliance/resources', body);
    setSaving(false);
    if (!result.ok) {
      setError(messageFor(result));
      return;
    }
    await onSaved();
  }

  async function remove() {
    if (!resource || !window.confirm(t('confirmDelete', { title: resource.title }))) return;
    setSaving(true);
    setError(null);
    const result = await deleteJson(`/api/self-reliance/resources/${resource.id}`);
    setSaving(false);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form noValidate onSubmit={submit} className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            {t(resource ? 'modal.editTitle' : 'modal.createTitle')}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <fieldset disabled={!canSave} className="flex flex-col gap-4">
            {error && <Alert tone="danger" role="alert" title={error} />}
            <Field label={t('modal.title')} value={draft.title} maxLength={RESOURCE_TITLE_MAX} onChange={(event) => patch({ title: event.target.value })} required />
            <Field
              type="url"
              label={t('modal.url')}
              hint={t('modal.urlHint')}
              value={draft.url}
              maxLength={RESOURCE_URL_MAX}
              inputMode="url"
              autoComplete="off"
              onChange={(event) => patch({ url: event.target.value })}
              required
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('modal.description')}</span>
              <textarea
                className={SELECT}
                rows={3}
                maxLength={RESOURCE_DESCRIPTION_MAX}
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('modal.category')}</span>
              <select aria-label={t('modal.category')} className={SELECT} value={draft.category} onChange={(event) => patch({ category: event.target.value as ResourceCategory })}>
                {RESOURCE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`categories.${category}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('modal.locale')}</span>
              <select aria-label={t('modal.locale')} className={SELECT} value={draft.locale} onChange={(event) => patch({ locale: event.target.value as ResourceLocale })}>
                {RESOURCE_LOCALES.map((item) => (
                  <option key={item} value={item}>
                    {t(`locales.${item}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-base text-text">
              <input type="checkbox" className="size-4 accent-primary" checked={draft.published} onChange={(event) => patch({ published: event.target.checked })} />
              {t('modal.published')}
            </label>
            <p className="text-sm text-text-muted">{t('modal.freeOnly')}</p>
          </fieldset>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div>
            {resource && canDelete && (
              <Button variant="secondary" disabled={saving} onClick={() => void remove()}>
                {t('modal.delete')}
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t('modal.cancel')}
            </Button>
            {canSave && (
              <Button type="submit" disabled={saving || draft.title.trim().length < 2 || !draft.url.trim()}>
                {t(resource ? 'modal.save' : 'modal.create')}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
