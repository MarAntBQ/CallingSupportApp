'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { putJson } from '@/lib/api-client';
import { Card } from './card';

// #36: exigir la verificación en dos pasos a todo usuario con algún módulo (el SuperAdmin ya la tiene obligatoria).
export function MfaPolicyCard({ initial }: { initial: boolean }) {
  const t = useTranslations('settings.mfa');
  const tErrors = useTranslations('errors');
  const id = useId();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: true } | { ok: false; message: string } | null>(null);

  async function toggle(next: boolean) {
    setValue(next);
    setSaving(true);
    setStatus(null);
    const result = await putJson<{ requireMfaForLeaders: boolean }>('/api/config/mfa', { requireMfaForLeaders: next });
    setSaving(false);
    if (result.ok) {
      setValue(result.data.requireMfaForLeaders);
      setStatus({ ok: true });
      return;
    }
    setValue(!next);
    setStatus({ ok: false, message: tErrors(result.error) });
  }

  return (
    <Card title={t('title')} intro={t('intro')}>
      <label htmlFor={id} className="flex items-start gap-2 text-base text-text">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={value}
          disabled={saving}
          onChange={(event) => void toggle(event.target.checked)}
        />
        {t('toggle')}
      </label>
      <div aria-live="polite" className="min-h-6 text-sm">
        {status?.ok && <span className="text-success-strong">{t('saved')}</span>}
      </div>
      {status && !status.ok && <Alert tone="danger" role="alert" title={status.message} />}
    </Card>
  );
}
