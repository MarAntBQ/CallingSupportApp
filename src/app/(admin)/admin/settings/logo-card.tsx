'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { UnitLogo } from '@/components/unit-brand';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { postJson, type ErrorCode } from '@/lib/api-client';
import { useSetConfig } from '@/lib/config/use-config';
import { LOGO_ACCEPT, LOGO_DATA_URL, LOGO_MAX_BYTES, type PublicConfig } from '@/lib/validation/config';
import { Card } from './card';

const ACCEPTED_TYPES = LOGO_ACCEPT.split(',');

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function LogoCard({ config }: { config: PublicConfig }) {
  const t = useTranslations('settings.logo');
  const tErrors = useTranslations('errors');
  const setConfig = useSetConfig();
  const router = useRouter();
  const fileId = useId();
  const confirmId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: true; message: string } | { ok: false; error: ErrorCode } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    setStatus(null);
    setFileError(null);
    setPending(null);
    const file = event.target.files?.[0];
    setFileName(file?.name ?? null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(t('badType'));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setFileError(t('tooLarge'));
      return;
    }
    const dataUrl = await readAsDataUrl(file).catch(() => null);
    if (!dataUrl || !LOGO_DATA_URL.test(dataUrl)) {
      setFileError(t('badType'));
      return;
    }
    setPending(dataUrl);
  }

  async function send(logoDataUrl: string | null) {
    setSaving(true);
    setStatus(null);
    const result = await postJson<PublicConfig>(
      '/api/config/logo',
      logoDataUrl ? { logoDataUrl, notOfficialLogo: confirmed } : { logoDataUrl: null },
    );
    setSaving(false);
    if (!result.ok) {
      if (result.fields.includes('logoDataUrl')) setFileError(t('badType'));
      setStatus({ ok: false, error: result.error });
      return;
    }
    await setConfig(result.data);
    router.refresh();
    setPending(null);
    setConfirmed(false);
    if (inputRef.current) inputRef.current.value = '';
    setFileName(null);
    setStatus({ ok: true, message: logoDataUrl ? t('saved') : t('removed') });
  }

  const preview = pending ?? config.logoDataUrl;

  return (
    <Card title={t('title')} intro={t('intro')}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <UnitLogo name={config.unitName} logoDataUrl={preview} size={96} />
          <p className="text-sm text-text-muted">{pending ? t('previewPending') : preview ? t('previewCurrent') : t('previewInitials')}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p id={`${fileId}-label`} className="text-sm font-medium text-text-muted">
              {t('file')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={fileId}
                className="cursor-pointer rounded-sm border border-primary px-4 py-2 text-base font-medium text-primary hover:border-primary-strong hover:text-primary-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
              >
                {t('choose')}
                <input
                  ref={inputRef}
                  id={fileId}
                  type="file"
                  accept={LOGO_ACCEPT}
                  onChange={onFile}
                  aria-labelledby={`${fileId}-label`}
                  aria-invalid={fileError ? true : undefined}
                  aria-describedby={`${fileId}-hint${fileError ? ` ${fileId}-error` : ''}`}
                  className="sr-only"
                />
              </label>
              <span className="min-w-0 truncate text-sm text-text-muted">{fileName ?? t('noFile')}</span>
            </div>
            <p id={`${fileId}-hint`} className="text-sm text-text-muted">
              {t('fileHint')}
            </p>
            {fileError && (
              <p id={`${fileId}-error`} className="text-sm text-danger-strong">
                {fileError}
              </p>
            )}
          </div>
          {pending && (
            <label htmlFor={confirmId} className="flex items-start gap-2 text-base text-text">
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              {t('notOfficial')}
            </label>
          )}
          {status &&
            (status.ok ? (
              <Alert tone="success" role="status" title={status.message} />
            ) : (
              <Alert tone="danger" role="alert" title={tErrors(status.error)} />
            ))}
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={!pending || !confirmed || saving} onClick={() => send(pending)}>
              {saving && pending ? t('saving') : t('save')}
            </Button>
            {config.logoDataUrl && !pending && (
              <Button type="button" variant="secondary" disabled={saving} onClick={() => send(null)}>
                {t('remove')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
