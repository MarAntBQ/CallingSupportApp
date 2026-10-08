'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { postJson } from '@/lib/api-client';
import { Card } from '../settings/card';

export function TelegramProfileCard({ linked, botConfigured }: { linked: boolean; botConfigured: boolean }) {
  const t = useTranslations('profile.telegram');
  const tErrors = useTranslations('errors');
  const [isLinked, setIsLinked] = useState(linked);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    setError(null);
    const result = await postJson<{ url: string }>('/api/auth/telegram/link', {});
    setBusy(false);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setUrl(result.data.url);
    window.open(result.data.url, '_blank', 'noopener');
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/auth/telegram/unlink', {});
    setBusy(false);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setIsLinked(false);
    setUrl(null);
  }

  return (
    <Card title={t('title')} intro={t('intro')}>
      <div className="flex flex-col gap-4">
        {!botConfigured ? (
          <Alert tone="info" role="status" title={t('noBot')} />
        ) : isLinked ? (
          <>
            <Alert tone="success" role="status" title={t('linked')} />
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void unlink()} className="self-start">
              {t('unlink')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">{t('notLinked')}</p>
            <Button type="button" disabled={busy} onClick={() => void link()} className="self-start">
              {t('link')}
            </Button>
            {url && (
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <p className="text-sm text-text-muted">{t('linkHint')}</p>
                <a href={url} target="_blank" rel="noopener" className="break-all font-medium text-primary underline-offset-4 hover:underline">
                  {url}
                </a>
              </div>
            )}
          </>
        )}
        {error && <Alert tone="danger" role="alert" title={error} />}
      </div>
    </Card>
  );
}
