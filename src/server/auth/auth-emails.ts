import 'server-only';
import { RESET_WINDOW_MINUTES } from '@/lib/validation/registration';
import { emailTranslator, type MailMessage } from '@/server/mail/service';
import { escapeHtml } from '@/server/mail/template';

function codeBlock(code: string) {
  return `<p style="margin:16px 0;font-size:28px;font-weight:bold;letter-spacing:6px;">${escapeHtml(code)}</p>`;
}

export function verificationEmail(to: string, code: string, locale: string | null): MailMessage {
  const t = emailTranslator(locale ?? undefined);
  return {
    to,
    subject: t('auth.verifySubject'),
    preheader: t('auth.verifyPreheader'),
    html: `<p>${escapeHtml(t('auth.verifyIntro'))}</p>${codeBlock(code)}<p>${escapeHtml(t('auth.verifyOutro'))}</p>`,
    text: `${t('auth.verifyIntro')} ${code}\n\n${t('auth.verifyOutro')}`,
    locale: locale ?? undefined,
  };
}

export function resetCodeEmail(to: string, code: string, locale: string | null): MailMessage {
  const t = emailTranslator(locale ?? undefined);
  const outro = t('auth.resetOutro', { minutes: RESET_WINDOW_MINUTES });
  return {
    to,
    subject: t('auth.resetSubject'),
    preheader: t('auth.resetPreheader'),
    html: `<p>${escapeHtml(t('auth.resetIntro'))}</p>${codeBlock(code)}<p>${escapeHtml(outro)}</p>`,
    text: `${t('auth.resetIntro')} ${code}\n\n${outro}`,
    locale: locale ?? undefined,
  };
}

export type MfaNotice = 'enabled' | 'disabled' | 'recoveryUsed' | 'reset';

// Avisos de la verificación en dos pasos (#36): nunca llevan códigos ni secretos.
export function mfaNoticeEmail(kind: MfaNotice, to: string, locale: string | null): MailMessage {
  const t = emailTranslator(locale ?? undefined);
  return {
    to,
    subject: t(`auth.mfa.${kind}.subject`),
    preheader: t(`auth.mfa.${kind}.preheader`),
    html: `<p>${escapeHtml(t(`auth.mfa.${kind}.body`))}</p>`,
    text: t(`auth.mfa.${kind}.body`),
    locale: locale ?? undefined,
  };
}

export function passwordChangedEmail(to: string, locale: string | null): MailMessage {
  const t = emailTranslator(locale ?? undefined);
  return {
    to,
    subject: t('auth.changedSubject'),
    preheader: t('auth.changedPreheader'),
    html: `<p>${escapeHtml(t('auth.changedBody'))}</p>`,
    text: t('auth.changedBody'),
    locale: locale ?? undefined,
  };
}
