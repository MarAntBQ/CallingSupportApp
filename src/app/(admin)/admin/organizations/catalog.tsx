'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { patchJson, postJson, type ApiResult } from '@/lib/api-client';
import {
  CATALOG_NAME_MAX,
  CATALOG_NAME_MIN,
  type CallingItem,
  type OrganizationItem,
} from '@/lib/validation/organizations';
import { Card } from '../settings/card';

const ORGANIZATIONS_KEY = ['organizations'] as const;
const CALLINGS_KEY = ['callings'] as const;

type TakenKey = 'organizationTaken' | 'callingTaken';

async function fetchList<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const validName = (value: string) => {
  const length = normalize(value).length;
  return length >= CATALOG_NAME_MIN && length <= CATALOG_NAME_MAX;
};

function useErrorMessage(taken: TakenKey) {
  const t = useTranslations('organizations.errors');
  const tErrors = useTranslations('errors');
  return (result: Extract<ApiResult<unknown>, { ok: false }>) => {
    const codes = new Set(result.issues.map((issue) => `${issue.field}:${issue.code}`));
    if (codes.has('name:taken')) return t(taken);
    if (codes.has('organizationId:inactive')) return t('organizationInactive');
    if (codes.has('organizationId:not_found') || result.error === 'not_found') return t('organizationMissing');
    if (result.error === 'invalid_input' && result.fields.includes('name')) return t('name');
    return tErrors(result.error);
  };
}

export function Catalog({
  initialOrganizations,
  initialCallings,
  canCreate,
  canUpdate,
}: {
  initialOrganizations: OrganizationItem[];
  initialCallings: CallingItem[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const t = useTranslations('organizations');
  const queryClient = useQueryClient();
  const { data: organizations = initialOrganizations } = useQuery({
    queryKey: ORGANIZATIONS_KEY,
    queryFn: () => fetchList<OrganizationItem>('/api/organizations'),
    initialData: initialOrganizations,
  });
  const { data: callings = initialCallings } = useQuery({
    queryKey: CALLINGS_KEY,
    queryFn: () => fetchList<CallingItem>('/api/callings'),
    initialData: initialCallings,
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: CALLINGS_KEY }),
    ]);
  const activeOrganizations = organizations.filter((organization) => organization.active);

  return (
    <div className="flex flex-col gap-6">
      {!canCreate && !canUpdate && <Alert tone="info" role="status" title={t('readOnly')} />}
      <Card title={t('organizationsTitle')} intro={t('organizationsIntro')}>
        {organizations.length === 0 ? (
          <p className="text-sm text-text-muted" data-testid="organizations-empty">
            {t('empty')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {organizations.map((organization) => (
              <CatalogRow
                key={organization.id}
                item={organization}
                url={`/api/organizations/${organization.id}`}
                inactiveLabel={t('inactive')}
                taken="organizationTaken"
                canUpdate={canUpdate}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
        {canCreate && (
          <AddForm
            label={t('newOrganization')}
            taken="organizationTaken"
            onAdd={(name) => postJson<OrganizationItem>('/api/organizations', { name })}
            onAdded={refresh}
          />
        )}
      </Card>

      <Card title={t('callingsTitle')} intro={t('callingsIntro')}>
        {activeOrganizations.length === 0 ? (
          <p className="text-sm text-text-muted">{t('callingsEmpty')}</p>
        ) : (
          activeOrganizations.map((organization) => {
            const own = callings.filter((calling) => calling.organizationId === organization.id);
            return (
              <section key={organization.id} className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
                <h3 className="text-base font-semibold text-text">{organization.name}</h3>
                {own.length === 0 ? (
                  <p className="text-sm text-text-muted">{t('noCallings')}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {own.map((calling) => (
                      <CatalogRow
                        key={calling.id}
                        item={calling}
                        url={`/api/callings/${calling.id}`}
                        inactiveLabel={t('inactiveCalling')}
                        taken="callingTaken"
                        canUpdate={canUpdate}
                        onChanged={refresh}
                      />
                    ))}
                  </ul>
                )}
                {canCreate && (
                  <AddForm
                    label={t('newCalling', { organization: organization.name })}
                    taken="callingTaken"
                    onAdd={(name) => postJson<CallingItem>('/api/callings', { organizationId: organization.id, name })}
                    onAdded={refresh}
                  />
                )}
              </section>
            );
          })
        )}
      </Card>
    </div>
  );
}

function AddForm({
  label,
  taken,
  onAdd,
  onAdded,
}: {
  label: string;
  taken: TakenKey;
  onAdd: (name: string) => Promise<ApiResult<unknown>>;
  onAdded: () => Promise<unknown>;
}) {
  const t = useTranslations('organizations');
  const errorMessage = useErrorMessage(taken);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = touched && !validName(name) ? t('errors.name') : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!validName(name)) return;
    setSaving(true);
    setError(null);
    const result = await onAdd(normalize(name));
    if (result.ok) {
      setName('');
      setTouched(false);
      await onAdded();
    } else {
      setError(errorMessage(result));
    }
    setSaving(false);
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Field
        label={label}
        value={name}
        maxLength={CATALOG_NAME_MAX}
        autoComplete="off"
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        onBlur={() => name && setTouched(true)}
        error={invalid ?? error ?? undefined}
        className="flex-1"
      />
      <Button type="submit" disabled={saving} className="sm:mt-7">
        {saving ? t('adding') : t('add')}
      </Button>
    </form>
  );
}

function CatalogRow({
  item,
  url,
  inactiveLabel,
  taken,
  canUpdate,
  onChanged,
}: {
  item: { id: string; name: string; active: boolean };
  url: string;
  inactiveLabel: string;
  taken: TakenKey;
  canUpdate: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const t = useTranslations('organizations');
  const errorMessage = useErrorMessage(taken);
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: { name?: string; active?: boolean }) {
    setSaving(true);
    setError(null);
    const result = await patchJson(url, body);
    if (result.ok) {
      await onChanged();
      setEditing(false);
    } else {
      setError(errorMessage(result));
    }
    setSaving(false);
  }

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validName(name)) {
      setError(t('errors.name'));
      return;
    }
    if (normalize(name) === item.name) {
      setEditing(false);
      return;
    }
    void send({ name: normalize(name) });
  }

  if (editing) {
    return (
      <li className="py-3">
        <form id={formId} noValidate onSubmit={rename} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field
            label={t('renameLabel', { name: item.name })}
            value={name}
            maxLength={CATALOG_NAME_MAX}
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            error={error ?? undefined}
            className="flex-1"
          />
          <div className="flex gap-2 sm:mt-7">
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setName(item.name);
                setError(null);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-base text-text">
          <span className={`break-words ${item.active ? '' : 'text-text-muted line-through'}`}>{item.name}</span>
          {!item.active && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-text-muted">{inactiveLabel}</span>
          )}
        </p>
        {canUpdate && (
          <div className="flex gap-1">
            <Button
              variant="link"
              disabled={saving}
              aria-label={t('renameItem', { name: item.name })}
              onClick={() => {
                setName(item.name);
                setError(null);
                setEditing(true);
              }}
            >
              {t('rename')}
            </Button>
            <Button
              variant="link"
              disabled={saving}
              aria-label={t(item.active ? 'deactivateItem' : 'activateItem', { name: item.name })}
              onClick={() => void send({ active: !item.active })}
            >
              {item.active ? t('deactivate') : t('activate')}
            </Button>
          </div>
        )}
      </div>
      {error && <Alert tone="danger" role="alert" title={error} />}
    </li>
  );
}
