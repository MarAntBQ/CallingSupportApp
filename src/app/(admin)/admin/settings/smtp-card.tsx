'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ErrorCode } from '@/lib/api-client';
import { SMTP_DEFAULT_PORT, smtpSchema, smtpTestSchema, type SmtpSummary } from '@/lib/validation/smtp';
import { Card } from './card';

const SMTP_QUERY_KEY = ['config', 'smtp'] as const;
const MAIL_ERRORS = ['smtp_not_configured', 'smtp_password_unreadable'] as const;

async function fetchSmtp(): Promise<SmtpSummary> {
  const response = await fetch('/api/config/smtp', { cache: 'no-store' });
  if (!response.ok) throw new Error(`smtp ${response.status}`);
  return response.json();
}

export function SmtpCard({ currentEmail }: { currentEmail: string }) {
  const { data } = useQuery({ queryKey: SMTP_QUERY_KEY, queryFn: fetchSmtp });
  if (!data) return null;
  return <SmtpForm summary={data} currentEmail={currentEmail} />;
}

type SmtpField = 'host' | 'port' | 'user' | 'password';

function SmtpForm({ summary, currentEmail }: { summary: SmtpSummary; currentEmail: string }) {
  const t = useTranslations('settings.smtp');
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const secureId = useId();
  const [host, setHost] = useState(summary.host ?? '');
  const [port, setPort] = useState(String(summary.port ?? SMTP_DEFAULT_PORT));
  const [secure, setSecure] = useState(summary.secure);
  const [user, setUser] = useState(summary.user ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Partial<Record<SmtpField, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ ok: true } | { ok: false; error: ErrorCode } | null>(null);
  const [to, setTo] = useState(currentEmail);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: true } | { ok: false; message: string } | null>(null);

  const input = {
    host,
    port: /^\d+$/.test(port.trim()) ? Number(port) : Number.NaN,
    secure,
    user,
    ...(password ? { password } : {}),
  };
  const parsed = smtpSchema.safeParse(input);
  const errors: Partial<Record<SmtpField, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]) as SmtpField;
      errors[field] ??= t(`errors.${field}`);
    }
  }
  if (!summary.hasPassword && !password) errors.password = t('errors.password');
  const valid = Object.keys(errors).length === 0;
  const changed =
    host.trim() !== (summary.host ?? '') ||
    Number(port) !== (summary.port ?? SMTP_DEFAULT_PORT) ||
    secure !== summary.secure ||
    user.trim() !== (summary.user ?? '') ||
    password !== '' ||
    !summary.host;
  const shown = (field: SmtpField) => (touched[field] ? errors[field] : undefined);
  const touch = (field: SmtpField) => setTouched((current) => ({ ...current, [field]: true }));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ host: true, port: true, user: true, password: true });
    if (!valid || !parsed.success) return;
    setSaving(true);
    setSaveStatus(null);
    const result = await postJson<SmtpSummary>('/api/config/smtp', parsed.data);
    setSaving(false);
    if (!result.ok) {
      setSaveStatus({ ok: false, error: result.error });
      return;
    }
    queryClient.setQueryData(SMTP_QUERY_KEY, result.data);
    setPassword('');
    setTouched({});
    setSaveStatus({ ok: true });
  }

  const testParsed = smtpTestSchema.safeParse({ to });

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!testParsed.success) return;
    setTesting(true);
    setTestStatus(null);
    const response = await fetch('/api/config/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testParsed.data),
    }).catch(() => null);
    setTesting(false);
    if (response?.ok) {
      setTestStatus({ ok: true });
      return;
    }
    const body = (await response?.json().catch(() => null)) as { error?: string; message?: string } | null;
    const known = MAIL_ERRORS.find((code) => code === body?.message);
    const message = known
      ? t(`mailErrors.${known}`)
      : body?.error === 'smtp_failed'
        ? body.message || tErrors('smtp_failed')
        : tErrors(response ? 'unknown' : 'network');
    setTestStatus({ ok: false, message });
  }

  return (
    <Card title={t('title')} intro={t('intro')}>
      <form noValidate onSubmit={save} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field
            label={t('host')}
            name="smtpHost"
            autoComplete="off"
            value={host}
            onChange={(event) => {
              setHost(event.target.value);
              touch('host');
            }}
            error={shown('host')}
            required
          />
          <Field
            label={t('port')}
            name="smtpPort"
            type="number"
            inputMode="numeric"
            min={1}
            max={65535}
            value={port}
            onChange={(event) => {
              setPort(event.target.value);
              touch('port');
            }}
            error={shown('port')}
            required
          />
        </div>
        <label htmlFor={secureId} className="flex items-start gap-2 text-base text-text">
          <input
            id={secureId}
            type="checkbox"
            name="smtpSecure"
            checked={secure}
            onChange={(event) => setSecure(event.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
          {t('secure')}
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t('user')}
            name="smtpUser"
            autoComplete="off"
            value={user}
            onChange={(event) => {
              setUser(event.target.value);
              touch('user');
            }}
            error={shown('user')}
            required
          />
          <Field
            label={t('password')}
            name="smtpPassword"
            type="password"
            autoComplete="new-password"
            placeholder={summary.hasPassword ? '••••••••' : undefined}
            hint={summary.hasPassword ? t('passwordSaved') : undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              touch('password');
            }}
            error={shown('password')}
            required={!summary.hasPassword}
          />
        </div>
        {saveStatus &&
          (saveStatus.ok ? (
            <Alert tone="success" role="status" title={t('saved')} />
          ) : (
            <Alert tone="danger" role="alert" title={tErrors(saveStatus.error)} />
          ))}
        <Button type="submit" disabled={saving || !valid || !changed} className="self-start">
          {saving ? t('saving') : t('save')}
        </Button>
      </form>

      {summary.host && (
        <form noValidate onSubmit={sendTest} className="flex flex-col gap-4 border-t border-border pt-5">
          <h3 className="text-base font-semibold text-text">{t('testTitle')}</h3>
          <Field
            label={t('testTo')}
            name="smtpTestTo"
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            error={to && !testParsed.success ? tCommon('invalidEmail') : undefined}
          />
          {testStatus &&
            (testStatus.ok ? (
              <Alert tone="success" role="status" title={t('testSent')} />
            ) : (
              <Alert tone="danger" role="alert" title={t('testFailed')}>
                <span className="break-words">{testStatus.message}</span>
              </Alert>
            ))}
          <Button type="submit" variant="secondary" disabled={testing || !testParsed.success} className="self-start">
            {testing ? t('testSending') : t('testSend')}
          </Button>
        </form>
      )}
    </Card>
  );
}

