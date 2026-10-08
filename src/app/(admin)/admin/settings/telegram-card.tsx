'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson } from '@/lib/api-client';
import { Card } from './card';

const TELEGRAM_QUERY_KEY = ['config', 'telegram'] as const;
type TelegramSummary = { botUsername: string | null; hasToken: boolean };

async function fetchTelegram(): Promise<TelegramSummary> {
  const response = await fetch('/api/config/telegram', { cache: 'no-store' });
  if (!response.ok) throw new Error(`telegram ${response.status}`);
  return response.json();
}

export function TelegramCard() {
  const { data } = useQuery({ queryKey: TELEGRAM_QUERY_KEY, queryFn: fetchTelegram });
  if (!data) return null;
  return <TelegramForm summary={data} />;
}

function TelegramForm({ summary }: { summary: TelegramSummary }) {
  const t = useTranslations('settings.telegram');
  const tErrors = useTranslations('errors');
  const queryClient = useQueryClient();
  const [botUsername, setBotUsername] = useState(summary.botUsername ?? '');
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: true } | { ok: false; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: true; botUsername: string } | { ok: false; message: string } | null>(null);

  const canSave = botUsername.trim().replace(/^@/, '').length >= 3 && botToken.trim().length >= 20;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setStatus(null);
    const result = await postJson<{ botUsername: string }>('/api/config/telegram', { botToken: botToken.trim(), botUsername: botUsername.trim() });
    setSaving(false);
    if (!result.ok) {
      const detail = (result.issues[0] as { message?: string } | undefined)?.message;
      setStatus({ ok: false, message: detail || tErrors(result.error) });
      return;
    }
    queryClient.setQueryData(TELEGRAM_QUERY_KEY, { botUsername: result.data.botUsername, hasToken: true });
    setBotToken('');
    setStatus({ ok: true });
  }

  async function test() {
    setTesting(true);
    setTestStatus(null);
    const response = await fetch('/api/config/telegram/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    setTesting(false);
    const body = (await response?.json().catch(() => null)) as { botUsername?: string; issues?: { message?: string }[] } | null;
    if (response?.ok && body?.botUsername) {
      setTestStatus({ ok: true, botUsername: body.botUsername });
      return;
    }
    setTestStatus({ ok: false, message: body?.issues?.[0]?.message || tErrors(response ? 'unknown' : 'network') });
  }

  return (
    <Card title={t('title')} intro={t('intro')}>
      <form noValidate onSubmit={save} className="flex flex-col gap-5">
        <Field label={t('botUsername')} name="telegramBotUsername" autoComplete="off" value={botUsername} onChange={(event) => setBotUsername(event.target.value)} required />
        <Field
          label={t('botToken')}
          name="telegramBotToken"
          type="password"
          autoComplete="new-password"
          placeholder={summary.hasToken ? '••••••••' : undefined}
          hint={summary.hasToken ? t('tokenSaved') : undefined}
          value={botToken}
          onChange={(event) => setBotToken(event.target.value)}
          required={!summary.hasToken}
        />
        {status &&
          (status.ok ? (
            <Alert tone="success" role="status" title={t('saved')} />
          ) : (
            <Alert tone="danger" role="alert" title={t('saveFailed')}>
              <span className="break-words">{status.message}</span>
            </Alert>
          ))}
        <Button type="submit" disabled={saving || !canSave} className="self-start">
          {saving ? t('saving') : t('save')}
        </Button>
      </form>

      {summary.hasToken && (
        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <h3 className="text-base font-semibold text-text">{t('testTitle')}</h3>
          {testStatus &&
            (testStatus.ok ? (
              <Alert tone="success" role="status" title={t('testOk', { bot: testStatus.botUsername })} />
            ) : (
              <Alert tone="danger" role="alert" title={t('testFailed')}>
                <span className="break-words">{testStatus.message}</span>
              </Alert>
            ))}
          <Button type="button" variant="secondary" disabled={testing} onClick={() => void test()} className="self-start">
            {testing ? t('testing') : t('test')}
          </Button>
        </div>
      )}
    </Card>
  );
}
