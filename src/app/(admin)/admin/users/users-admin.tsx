'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { SortHeader } from '@/components/table/sort-header';
import { TablePagination } from '@/components/table/table-pagination';
import { TableScroll } from '@/components/table/table-scroll';
import { TableToolbar } from '@/components/table/table-toolbar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { patchJson, postJson, type ApiResult } from '@/lib/api-client';
import { LEADER_LEVEL } from '@/lib/modules';
import type { SortAccessors } from '@/lib/table/table-logic';
import { useTableControls } from '@/lib/table/use-table-controls';
import type { UserListItem } from '@/server/users/users';

type Role = { id: string; key: string; name: string; level: number };
type Org = { id: string; name: string; callings: { id: string; name: string; organizationId: string }[] };
type Tab = 'leaders' | 'all';
const LOCALES = ['es', 'pt', 'en'] as const;
const ERROR_KEYS = ['email_taken', 'role_not_found', 'invalid_calling'] as const;

const displayName = (user: { lastName: string; firstName: string }) => `${user.lastName}, ${user.firstName}`;

function usersKey() {
  return ['users'] as const;
}

async function fetchUsers(): Promise<UserListItem[]> {
  const response = await fetch('/api/users', { cache: 'no-store' });
  if (!response.ok) throw new Error(`users ${response.status}`);
  return response.json();
}

function codeOf(result: Extract<ApiResult<unknown>, { ok: false }>): (typeof ERROR_KEYS)[number] | null {
  const code = result.issues[0]?.code;
  return ERROR_KEYS.find((candidate) => candidate === code) ?? null;
}

export function UsersAdmin({
  initialUsers,
  roles,
  orgs,
  canCreate,
  canUpdate,
  canResetMfa,
  currentUserId,
}: {
  initialUsers: UserListItem[];
  roles: Role[];
  orgs: Org[];
  canCreate: boolean;
  canUpdate: boolean;
  canResetMfa: boolean;
  currentUserId: string;
}) {
  const t = useTranslations('users');
  const tRoles = useTranslations('roles');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: usersKey(), queryFn: fetchUsers, initialData: initialUsers });

  const [tab, setTab] = useState<Tab>('all');
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [creating, setCreating] = useState(false);

  // ?edit=<id> abre el modal de ese usuario al montar (enlace desde el consejo de barrio): es
  // sincronizar el estado con la URL, un sistema externo, una sola vez.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    const found = id ? users.find((user) => user.id === id) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setEditing(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => users.filter((user) => (tab === 'leaders' ? user.role.level >= LEADER_LEVEL : true)), [users, tab]);
  const orgNames = (user: UserListItem) => user.organizations.map((org) => org.name).join(' ');
  const search = (user: UserListItem) => `${user.firstName} ${user.lastName} ${user.email} ${user.callingLabel ?? ''} ${user.role.name} ${orgNames(user)}`;
  const sortAccessors = useMemo<SortAccessors<UserListItem>>(() => ({ name: (user) => `${user.lastName} ${user.firstName}`, role: (user) => user.role.level }), []);
  const table = useTableControls(rows, { search, defaultSortKey: 'name', sortAccessors, locale });
  const refresh = () => queryClient.invalidateQueries({ queryKey: usersKey() });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        {canCreate && <Button onClick={() => setCreating(true)}>{t('newUser')}</Button>}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('title')}>
        {(['leaders', 'all'] as const).map((key) => (
          <Button key={key} role="tab" aria-selected={tab === key} variant={tab === key ? 'secondary' : 'link'} onClick={() => setTab(key)}>
            {t(`tabs.${key}`)}
          </Button>
        ))}
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="min-w-0 rounded-md border border-border bg-surface">
          <TableToolbar table={table} />
          <TableScroll label={t('title')}>
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr>
                  <SortHeader table={table} column="name" label={t('columns.name')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.calling')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.email')}</th>
                  <SortHeader table={table} column="role" label={t('columns.role')} />
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.organizations')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.status')}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-text-muted">{t('columns.telegram')}</th>
                </tr>
              </thead>
              <tbody>
                {table.view.map((user) => (
                  <tr key={user.id} className="even:bg-surface-muted">
                    <td className="px-3 py-2">
                      <button type="button" className="text-left font-medium text-primary underline-offset-4 hover:underline" onClick={() => setEditing(user)}>
                        {displayName(user)}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-text-muted">{user.callingLabel || t('none')}</td>
                    <td className="px-3 py-2 text-text-muted">{user.email}</td>
                    <td className="px-3 py-2 text-text">{tRoles(user.role.key as Parameters<typeof tRoles>[0])}</td>
                    <td className="px-3 py-2 text-text-muted">{user.organizations.length > 0 ? user.organizations.map((org) => org.name).join(', ') : t('none')}</td>
                    <td className="px-3 py-2">{t(`status.${user.status}`)}</td>
                    <td className="px-3 py-2 text-text-muted">{user.telegramLinked ? t('telegram.linked') : t('telegram.no')}</td>
                  </tr>
                ))}
                {table.view.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-text-muted">{t('noRows')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
          <TablePagination table={table} />
        </div>
      )}

      {editing && (
        <UserModal mode="edit" user={editing} roles={roles} orgs={orgs} canUpdate={canUpdate} canResetMfa={canResetMfa} isSelf={editing.id === currentUserId} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} onMfaReset={refresh} />
      )}
      {creating && (
        <UserModal mode="create" roles={roles} orgs={orgs} canUpdate={canUpdate} canResetMfa={false} isSelf={false} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} />
      )}
    </section>
  );
}

type Draft = { firstName: string; lastName: string; email: string; phone: string; roleId: string; callingLabel: string; callingIds: string[]; locale: '' | (typeof LOCALES)[number]; status: UserListItem['status'] };

function UserModal({
  mode,
  user,
  roles,
  orgs,
  canUpdate,
  canResetMfa,
  isSelf,
  onClose,
  onSaved,
  onMfaReset,
}: {
  mode: 'create' | 'edit';
  user?: UserListItem;
  roles: Role[];
  orgs: Org[];
  canUpdate: boolean;
  canResetMfa: boolean;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
  onMfaReset?: () => Promise<unknown>;
}) {
  const t = useTranslations('users');
  const tRoles = useTranslations('roles');
  const tErrors = useTranslations('errors');
  const titleId = useId();
  const [draft, setDraft] = useState<Draft>({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    roleId: user?.role.id ?? '',
    callingLabel: user?.callingLabel ?? '',
    callingIds: user?.callings.map((calling) => calling.id) ?? [],
    locale: (user?.locale as Draft['locale']) ?? '',
    status: user?.status ?? 'active',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(Boolean(user?.telegramLinked));
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfaEnabled));
  const [mfaResetting, setMfaResetting] = useState(false);
  const [mfaNotice, setMfaNotice] = useState<string | null>(null);

  async function resetMfa() {
    if (!user || !window.confirm(t('mfa.confirm'))) return;
    setError(null);
    setMfaResetting(true);
    const result = await postJson(`/api/users/${user.id}/mfa/reset`, {});
    setMfaResetting(false);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setMfaEnabled(false);
    setMfaNotice(t('mfa.done'));
    await onMfaReset?.();
  }

  async function unlinkTelegram() {
    if (!user) return;
    setError(null);
    const result = await postJson(`/api/users/${user.id}/telegram/unlink`, {});
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setTelegramLinked(false);
  }

  const selectedRole = roles.find((role) => role.id === draft.roleId);
  const callingsEnabled = (selectedRole?.level ?? 0) >= LEADER_LEVEL;
  const complete = draft.roleId && (mode === 'edit' || (draft.firstName.trim() && draft.lastName.trim() && draft.email.trim()));

  function patch(next: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...next }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate || !complete) return;
    setSaving(true);
    setError(null);
    const callingIds = callingsEnabled ? draft.callingIds : [];
    const result =
      mode === 'create'
        ? await postJson('/api/users', {
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            email: draft.email.trim(),
            ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
            roleId: draft.roleId,
            callingIds,
            ...(draft.callingLabel.trim() ? { callingLabel: draft.callingLabel.trim() } : {}),
            ...(draft.locale ? { locale: draft.locale } : {}),
          })
        : await patchJson(`/api/users/${user!.id}`, { roleId: draft.roleId, status: draft.status, callingIds, callingLabel: draft.callingLabel.trim(), ...(draft.locale ? { locale: draft.locale } : {}) });
    setSaving(false);
    if (!result.ok) {
      const code = codeOf(result);
      setError(code ? t(`errors.${code}`) : tErrors(result.error));
      return;
    }
    await onSaved();
  }

  async function doReset() {
    setError(null);
    const result = await postJson<{ password: string }>(`/api/users/${user!.id}/reset-password`, {});
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setTempPassword(result.data.password);
    setCopied(false);
  }

  async function copy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-lg">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">{t(mode === 'create' ? 'modal.createTitle' : 'modal.editTitle')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger" role="alert" title={error} />}
            {mode === 'create' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('modal.firstName')} value={draft.firstName} onChange={(event) => patch({ firstName: event.target.value })} />
                <Field label={t('modal.lastName')} value={draft.lastName} onChange={(event) => patch({ lastName: event.target.value })} />
                <Field type="email" label={t('modal.email')} value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
                <Field type="tel" label={t('modal.phone')} value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} />
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('modal.role')}</span>
              <select
                aria-label={t('modal.role')}
                disabled={!canUpdate}
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                value={draft.roleId}
                onChange={(event) => patch({ roleId: event.target.value, callingIds: [] })}
              >
                <option value="" disabled>{t('modal.rolePlaceholder')}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{tRoles(role.key as Parameters<typeof tRoles>[0])}</option>
                ))}
              </select>
            </label>
            <Field label={t('modal.callingLabel')} value={draft.callingLabel} disabled={!canUpdate} onChange={(event) => patch({ callingLabel: event.target.value })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t('modal.locale')}</span>
              <select
                aria-label={t('modal.locale')}
                disabled={!canUpdate}
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                value={draft.locale}
                onChange={(event) => patch({ locale: event.target.value as Draft['locale'] })}
              >
                <option value="">{t('modal.localePlaceholder')}</option>
                {LOCALES.map((item) => (
                  <option key={item} value={item}>{t(`locales.${item}`)}</option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3" disabled={!callingsEnabled || !canUpdate}>
              <legend className="px-1 text-sm font-medium text-text-muted">{t('modal.callings')}</legend>
              {!callingsEnabled && <p className="text-xs text-text-muted">{t('modal.callingsDisabled')}</p>}
              {orgs.map((org) => (
                <div key={org.id} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text-muted">{org.name}</span>
                  {org.callings.map((calling) => (
                    <label key={calling.id} className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={draft.callingIds.includes(calling.id)}
                        onChange={(event) => patch({ callingIds: event.target.checked ? [...draft.callingIds, calling.id] : draft.callingIds.filter((id) => id !== calling.id) })}
                      />
                      {calling.name}
                    </label>
                  ))}
                </div>
              ))}
            </fieldset>
            {mode === 'edit' && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-text-muted">{t('modal.status')}</span>
                  <select
                    aria-label={t('modal.status')}
                    disabled={!canUpdate}
                    className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                    value={draft.status}
                    onChange={(event) => patch({ status: event.target.value as UserListItem['status'] })}
                  >
                    {(['pending', 'active', 'suspended'] as const).map((status) => (
                      <option key={status} value={status}>{t(`status.${status}`)}</option>
                    ))}
                  </select>
                </label>
                {canUpdate && (
                  <div className="rounded-md border border-border p-3">
                    {tempPassword ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-text-muted">{t('resetPassword.note')}</p>
                        <div className="flex items-center gap-2">
                          <code className="rounded-sm bg-surface-muted px-2 py-1 text-base text-text">{tempPassword}</code>
                          <Button type="button" variant="secondary" onClick={() => void copy()}>{copied ? t('resetPassword.copied') : t('resetPassword.copy')}</Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="secondary" onClick={() => void doReset()}>{t('resetPassword.button')}</Button>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <span className="text-sm text-text-muted">{telegramLinked ? t('telegram.linkedStatus') : t('telegram.notLinked')}</span>
                  {canUpdate && telegramLinked && (
                    <Button type="button" variant="secondary" onClick={() => void unlinkTelegram()}>{t('telegram.unlink')}</Button>
                  )}
                </div>
                <div className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="user-mfa">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-text-muted">
                      {t('mfa.label')}: <span className="font-medium text-text">{mfaEnabled ? t('mfa.on') : t('mfa.off')}</span>
                    </span>
                    {canResetMfa && !isSelf && mfaEnabled && (
                      <Button type="button" variant="secondary" disabled={mfaResetting} onClick={() => void resetMfa()}>
                        {mfaResetting ? t('mfa.resetting') : t('mfa.reset')}
                      </Button>
                    )}
                  </div>
                  {canResetMfa && isSelf && <p className="text-sm text-text-muted">{t('mfa.ownNote')}</p>}
                  {mfaNotice && <p className="text-sm text-success-strong" role="status">{mfaNotice}</p>}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>{t('modal.cancel')}</Button>
          {canUpdate && <Button type="submit" disabled={saving || !complete}>{t(mode === 'create' ? 'modal.create' : 'modal.save')}</Button>}
        </div>
      </form>
    </div>
  );
}
