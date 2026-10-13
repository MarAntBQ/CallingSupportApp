'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';

type Item = { id: string; name: string; detail: string | null; category: string; checked: boolean };

export function PackingChecklist({ token, items }: { token: string; items: Item[] }) {
  const t = useTranslations('camps.me.packing');
  const [state, setState] = useState(items);
  // Un ítem en vuelo por su id (no un solo slot): cada casilla se bloquea solo a sí misma mientras
  // guarda, para que marcar otro ítem no reactive el que todavía está guardando.
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  // La última elección del usuario por ítem que el servidor TODAVÍA no confirma. Sobrevive a `busy`
  // (que solo dura la petición): si un router.refresh trae una foto tomada antes de que el guardado
  // se comprometiera pero que llega después de que `busy` se limpió, no pisamos el check ya guardado.
  // Se limpia en cuanto el servidor ya refleja ese valor, o si la petición falla.
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [failed, setFailed] = useState(false);

  // El padre es un server component: en router.refresh() (p. ej. al cambiar de idioma) llega un
  // `items` nuevo con la lista y los checks del servidor. Reconciliamos en render (patrón oficial de
  // React, no useEffect): tomamos la lista del servidor, pero para el `checked` preferimos la
  // intención del usuario aún no confirmada (`pending`); y limpiamos de `pending` lo que el servidor
  // ya refleja, para que después un cambio externo real sí se vea.
  const [synced, setSynced] = useState(items);
  if (synced !== items) {
    setSynced(items);
    setState(
      items.map((incoming) => {
        const want = pending.get(incoming.id);
        return want === undefined ? incoming : { ...incoming, checked: want };
      }),
    );
    setPending((current) => {
      let changed = false;
      const next = new Map(current);
      for (const incoming of items) {
        if (next.has(incoming.id) && next.get(incoming.id) === incoming.checked) {
          next.delete(incoming.id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  if (state.length === 0) return null;
  const done = state.filter((item) => item.checked).length;

  const toggle = async (id: string, checked: boolean) => {
    if (busy.has(id)) return;
    setBusy((current) => new Set(current).add(id));
    setFailed(false);
    setPending((current) => new Map(current).set(id, checked));
    setState((current) => current.map((item) => (item.id === id ? { ...item, checked } : item)));
    try {
      const response = await fetch(`/api/camps/me/${encodeURIComponent(token)}/packing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: id, checked }),
      });
      if (!response.ok) throw new Error('request_failed');
    } catch {
      setState((current) => current.map((item) => (item.id === id ? { ...item, checked: !checked } : item)));
      setPending((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
      setFailed(true);
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4" data-testid="me-packing">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-text">{t('title')}</h2>
        <span className="text-sm text-text-muted">{t('progress', { done, total: state.length })}</span>
      </div>
      {failed && <Alert tone="danger" role="alert" title={t('error')} />}
      <ul className="flex flex-col gap-2">
        {state.map((item) => (
          <li key={item.id}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={item.checked}
                disabled={busy.has(item.id)}
                onChange={(event) => toggle(item.id, event.target.checked)}
                className="mt-1 size-5 shrink-0 accent-primary disabled:opacity-60"
              />
              <span className="flex flex-col">
                <span className="text-base text-text">{item.name}</span>
                {item.detail && <span className="text-sm text-text-muted">{item.detail}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
