'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postJson, type ApiResult } from '@/lib/api-client';
import type { MfaStatusView } from '@/lib/validation/mfa';
import { Card } from '../../settings/card';

type Setup = { qrSvg: string; secret: string };

function fieldError(result: Extract<ApiResult<unknown>, { ok: false }>, t: (key: 'errors.incorrect' | 'errors.passwordIncorrect' | 'errors.notStarted') => string) {
  const issue = result.issues[0];
  if (issue?.code === 'not_started') return t('errors.notStarted');
  if (issue?.field === 'password') return t('errors.passwordIncorrect');
  return t('errors.incorrect');
}

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export function SecurityPanel({ initial }: { initial: MfaStatusView }) {
  const t = useTranslations('security');
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  // Ya activa en el servidor, pero falta que confirme que guardó los códigos de recuperación.
  const [savingCodes, setSavingCodes] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card title={t('cardTitle')}>
        <p className="text-base text-text" data-testid="mfa-status">
          <span className="text-text-muted">{t('statusLabel')}: </span>
          <span className="font-semibold">{enabled ? t('on') : t('off')}</span>
        </p>
        {notice && <Alert tone="success" role="status" title={notice} />}
        {initial.demo ? (
          <Alert tone="info" role="status" title={t('demo')} />
        ) : !enabled || savingCodes ? (
          <>
            {!enabled && initial.required && <Alert tone="warning" role="status" title={t('required')} />}
            {!enabled && initial.recommended && <Alert tone="info" role="status" title={t('recommended')} />}
            <EnableFlow
              onActivated={() => {
                setEnabled(true);
                setSavingCodes(true);
              }}
              onFinished={() => {
                setSavingCodes(false);
                setNotice(t('enabledDone'));
                router.refresh();
              }}
            />
          </>
        ) : null}
      </Card>
      {enabled && !savingCodes && !initial.demo && (
        <>
          <RegenerateCard />
          <DisableCard
            required={initial.required}
            onDisabled={() => {
              setEnabled(false);
              setNotice(t('disabledDone'));
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}

function EnableFlow({ onActivated, onFinished }: { onActivated: () => void; onFinished: () => void }) {
  const t = useTranslations('security');
  const tErrors = useTranslations('errors');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await postJson<Setup>('/api/auth/mfa/setup', {});
    setBusy(false);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setSetup(result.data);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await postJson<{ recoveryCodes: string[] }>('/api/auth/mfa/enable', { code });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'invalid_input' ? fieldError(result, t) : tErrors(result.error));
      return;
    }
    setSetup(null);
    setCodes(result.data.recoveryCodes);
    onActivated();
  }

  if (codes) return <RecoveryCodes codes={codes} onFinish={onFinished} />;

  if (!setup) {
    return (
      <div className="flex flex-col gap-3">
        {error && <Alert tone="danger" role="alert" title={error} />}
        <div>
          <Button onClick={() => void start()} disabled={busy}>
            {busy ? t('starting') : t('enable')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-text">{t('step1Title')}</h3>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR en data-URL generado al momento, no optimizable por next/image */}
        <img
          src={`data:image/svg+xml;base64,${btoa(setup.qrSvg)}`}
          alt={t('qrAlt')}
          width={200}
          height={200}
          className="size-48 rounded-sm border border-border bg-white p-2 sm:size-52"
        />
        <p className="text-sm text-text-muted">{t('step1Body')}</p>
        <p className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">{t('secretLabel')}</span>
          <code className="break-all rounded-sm bg-surface-muted px-2 py-1 font-mono text-base text-text" data-testid="mfa-secret">
            {setup.secret}
          </code>
        </p>
      </div>
      <form noValidate onSubmit={confirm} className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-text">{t('step2Title')}</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field
            label={t('code')}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(onlyDigits(event.target.value))}
            error={error ?? undefined}
            className="sm:w-48"
            required
          />
          <Button type="submit" disabled={busy || code.length !== 6} className="sm:mt-7">
            {busy ? t('confirming') : t('confirm')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function RecoveryCodes({ codes, onFinish }: { codes: string[]; onFinish: () => void }) {
  const t = useTranslations('security');
  const checkId = useId();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'callingsupportapp-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="recovery-codes">
      <h3 className="text-base font-semibold text-text">{t('step3Title')}</h3>
      <p className="text-sm text-text-muted">{t('step3Body')}</p>
      <ul className="grid grid-cols-2 gap-2 rounded-sm bg-surface-muted p-3 font-mono text-base text-text">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? t('copied') : t('copy')}
        </Button>
        <Button variant="secondary" onClick={download}>
          {t('download')}
        </Button>
      </div>
      <label htmlFor={checkId} className="flex items-center gap-2 text-base text-text">
        <input id={checkId} type="checkbox" className="size-4 accent-primary" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        {t('savedCheck')}
      </label>
      <div>
        <Button onClick={onFinish} disabled={!saved}>
          {t('finish')}
        </Button>
      </div>
    </div>
  );
}

function RegenerateCard() {
  const t = useTranslations('security');
  const tErrors = useTranslations('errors');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await postJson<{ recoveryCodes: string[] }>('/api/auth/mfa/recovery-codes', { code });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'invalid_input' ? fieldError(result, t) : tErrors(result.error));
      return;
    }
    setCode('');
    setCodes(result.data.recoveryCodes);
  }

  return (
    <Card title={t('regenerateTitle')} intro={t('regenerateBody')}>
      {codes ? (
        <RecoveryCodes codes={codes} onFinish={() => setCodes(null)} />
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field
            label={t('code')}
            name="regenerateCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(onlyDigits(event.target.value))}
            error={error ?? undefined}
            className="sm:w-48"
            required
          />
          <Button type="submit" variant="secondary" disabled={busy || code.length !== 6} className="sm:mt-7">
            {busy ? t('regenerating') : t('regenerate')}
          </Button>
        </form>
      )}
    </Card>
  );
}

function DisableCard({ required, onDisabled }: { required: boolean; onDisabled: () => void }) {
  const t = useTranslations('security');
  const tErrors = useTranslations('errors');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; code?: string; form?: string }>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    const result = await postJson('/api/auth/mfa/disable', { password, code });
    setBusy(false);
    if (result.ok) {
      onDisabled();
      return;
    }
    if (result.error !== 'invalid_input') {
      setErrors({ form: tErrors(result.error) });
      return;
    }
    const message = fieldError(result, t);
    setErrors(result.fields.includes('password') ? { password: message } : { code: message });
  }

  return (
    <Card title={t('disableTitle')} intro={required ? undefined : t('disableBody')}>
      {required ? (
        <p className="text-sm text-text-muted">{t('requiredNoDisable')}</p>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {errors.form && <Alert tone="danger" role="alert" title={errors.form} />}
          <Field
            label={t('password')}
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            required
          />
          <Field
            label={t('codeOrRecovery')}
            name="disableCode"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={errors.code}
            required
          />
          <div>
            <Button type="submit" variant="secondary" disabled={busy || !password || !code}>
              {busy ? t('disabling') : t('disable')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
