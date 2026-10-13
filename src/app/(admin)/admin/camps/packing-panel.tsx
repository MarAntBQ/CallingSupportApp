'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { deleteJson, postJson } from '@/lib/api-client';
import { PACKING_APPLIES_TO } from '@/lib/validation/camps';
import { participantsKey } from './participants-panel';

type Item = { id: string; name: string; detail: string | null; category: string; appliesTo: string; position: number };

const packingKey = (campId: string) => ['camps', campId, 'packing'] as const;

async function fetchPacking(campId: string): Promise<Item[]> {
  const response = await fetch(`/api/camps/${campId}/packing`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`packing ${response.status}`);
  return response.json();
}

const emptyForm = { name: '', detail: '', category: '', appliesTo: 'all' };

export function PackingPanel({ campId, canUpdate }: { campId: string; canUpdate: boolean }) {
  const t = useTranslations('camps.packing');
  const queryClient = useQueryClient();
  const { data: items = [], isError, isPending } = useQuery({ queryKey: packingKey(campId), queryFn: () => fetchPacking(campId) });
  const [form, setForm] = useState(emptyForm);
  const [actionError, setActionError] = useState<'saveError' | 'deleteError' | null>(null);

  const appliesLabel = (value: string) =>
    value === 'youth' ? t('appliesTo.youth') : value === 'leader' ? t('appliesTo.leader') : t('appliesTo.all');

  // Agregar o borrar un ítem cambia también los conteos packingDone/packingTotal que muestra
  // ParticipantsPanel (query aparte): hay que invalidar ambas, no solo la de packing.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: packingKey(campId) }),
      queryClient.invalidateQueries({ queryKey: participantsKey(campId) }),
    ]);

  const addMutation = useMutation({
    mutationFn: () =>
      postJson(`/api/camps/${campId}/packing`, {
        name: form.name,
        detail: form.detail || undefined,
        category: form.category,
        appliesTo: form.appliesTo,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        setActionError('saveError');
        return;
      }
      setActionError(null);
      setForm(emptyForm);
      void invalidate();
    },
    onError: () => setActionError('saveError'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/camps/${campId}/packing/${id}`),
    onSuccess: (result) => {
      if (!result.ok) {
        setActionError('deleteError');
        return;
      }
      setActionError(null);
      void invalidate();
    },
    onError: () => setActionError('deleteError'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    addMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      {isError && <Alert tone="danger" role="alert" title={t('loadError')} />}
      {actionError && <Alert tone="danger" role="alert" title={t(actionError)} />}
      {isPending ? (
        <p className="text-sm text-text-muted">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t('title')}>
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-sm border border-border px-3 py-2">
              <span className="flex flex-col">
                <span className="text-base text-text">{item.name}</span>
                <span className="text-sm text-text-muted">{t('itemMeta', { applies: appliesLabel(item.appliesTo), category: item.category })}</span>
                {item.detail && <span className="text-sm text-text-muted">{item.detail}</span>}
              </span>
              {canUpdate && (
                <Button
                  variant="link"
                  className="text-danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(item.id)}
                  aria-label={t('deleteItem', { name: item.name })}
                >
                  {t('delete')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpdate && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label={t('name')} value={form.name} maxLength={120} required disabled={addMutation.isPending} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} />
          <Field label={t('category')} value={form.category} maxLength={40} required disabled={addMutation.isPending} onChange={(event) => setForm((f) => ({ ...f, category: event.target.value }))} />
          <Field label={t('detail')} value={form.detail} maxLength={200} disabled={addMutation.isPending} onChange={(event) => setForm((f) => ({ ...f, detail: event.target.value }))} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="packing-applies-to" className="text-sm font-medium text-text-muted">
              {t('appliesToLabel')}
            </label>
            <select
              id="packing-applies-to"
              value={form.appliesTo}
              disabled={addMutation.isPending}
              onChange={(event) => setForm((f) => ({ ...f, appliesTo: event.target.value }))}
              className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary disabled:bg-surface-muted disabled:text-text-muted"
            >
              {PACKING_APPLIES_TO.map((value) => (
                <option key={value} value={value}>
                  {appliesLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={addMutation.isPending} className="self-end">
            {addMutation.isPending ? t('adding') : t('add')}
          </Button>
        </form>
      )}
    </div>
  );
}
