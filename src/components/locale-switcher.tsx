'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { isLocale, LOCALE_NAMES, LOCALES } from '@/i18n/config';

export function LocaleSwitcher() {
  const t = useTranslations('common.localeSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [selected, setSelected] = useState(locale);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  async function change(next: string) {
    if (saving || !isLocale(next) || next === locale) return;
    setSelected(next);
    setFailed(false);
    setSaving(true);
    const response = await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setSelected(locale);
      setFailed(true);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-center gap-1 text-sm">
      <label htmlFor={id} className="text-text-muted">
        {t('label')}
      </label>
      <select
        id={id}
        value={selected}
        disabled={saving || pending}
        onChange={(event) => void change(event.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-text"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={option}>
            {LOCALE_NAMES[option]}
          </option>
        ))}
      </select>
      {failed && (
        <p role="alert" className="text-danger">
          {t('error')}
        </p>
      )}
    </div>
  );
}
