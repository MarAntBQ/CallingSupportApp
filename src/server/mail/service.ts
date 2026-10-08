import 'server-only';
import { desc, eq, lt } from 'drizzle-orm';
import { createTranslator } from 'next-intl';
import nodemailer, { type Transporter } from 'nodemailer';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import pt from '../../../messages/pt.json';
import { isLocale, type Locale } from '@/i18n/config';
import { decrypt } from '@/server/crypto/aes';
import { getDb, type Database } from '@/server/db';
import { appConfig, emailLog } from '@/server/db/schema';
import { z } from 'zod';
import { resolveSmtpTarget, SmtpHostNotAllowedError } from './host-guard';
import { buildBrandedEmail } from './template';

const MESSAGES = { es, pt, en };

export const SEND_TIMEOUT_MS = 30_000;
export const TEST_TIMEOUT_MS = 15_000;
export const LOG_LIMIT = 200;
export const MAX_ERROR_LENGTH = 500;
export const LOG_RETENTION_DAYS = 180;

const recipient = z.string().trim().toLowerCase().pipe(z.email().max(254));

export { MAIL_ERROR_CODES } from '@/lib/mail-errors';

export type SmtpSettings = { host: string; port: number; secure: boolean; user: string; password: string; servername?: string };

export type MailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  preheader?: string;
  locale?: string;
};

type TransportFactory = (settings: SmtpSettings, timeoutMs: number) => Pick<Transporter, 'sendMail'>;

export const defaultTransport: TransportFactory = (settings, timeoutMs) =>
  nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    ...(settings.servername ? { tls: { servername: settings.servername } } : {}),
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });

export function emailTranslator(locale: string | undefined) {
  const lang: Locale = isLocale(locale) ? locale : 'es';
  return createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'emails' });
}

async function loadSmtp(db: Database) {
  const [row] = await db
    .select({
      unitName: appConfig.unitName,
      host: appConfig.smtpHost,
      port: appConfig.smtpPort,
      secure: appConfig.smtpSecure,
      user: appConfig.smtpUser,
      passwordEnc: appConfig.smtpPasswordEnc,
    })
    .from(appConfig)
    .where(eq(appConfig.id, 1))
    .limit(1);
  return row;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado (${timeoutMs / 1000} s)`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function purgeExpiredMailLogs(db: Database, now = new Date()) {
  const deleted = await db
    .delete(emailLog)
    .where(lt(emailLog.createdAt, new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)))
    .returning({ id: emailLog.id });
  return deleted.length;
}

// "maria.perez@example.com" → "m***@example.com": se ve el dominio para revisar el SMTP, no la persona.
export function maskEmail(address: string) {
  const at = address.lastIndexOf('@');
  if (at < 1) return '***';
  return `${address.slice(0, 1)}***${address.slice(at)}`;
}

async function log(
  db: Database,
  mask: boolean | undefined,
  entry: { source: string; to: string; subject: string; success: boolean; error: string | null },
) {
  if (mask) entry = { ...entry, to: maskEmail(entry.to) };
  try {
    await purgeExpiredMailLogs(db);
    await db.insert(emailLog).values({
      source: entry.source.slice(0, 100),
      emailTo: entry.to.slice(0, 254),
      emailSubject: entry.subject.slice(0, 300),
      success: entry.success,
      errorMessage: entry.error?.slice(0, MAX_ERROR_LENGTH) ?? null,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'email_log_failed', name: (error as Error | null)?.name }));
  }
}

export async function sendMail(
  source: string,
  message: MailMessage,
  // maskRecipient: el registro de envíos guarda el destinatario enmascarado (p. ej. a los
  // tutores del campamento, que no son usuarios: su correo ya está en su inscripción).
  options: { db?: Database; timeoutMs?: number; transport?: TransportFactory; maskRecipient?: boolean } = {},
): Promise<{ sent: boolean; error?: string }> {
  let db: Database | undefined;
  try {
    db = options.db ?? getDb();
    const to = recipient.safeParse(message.to);
    if (!to.success || /[\r\n]/.test(message.subject) || !message.subject.trim()) {
      await log(db, options.maskRecipient, { source, to: String(message.to ?? '').replace(/[\r\n]/g, ' '), subject: message.subject.replace(/[\r\n]/g, ' '), success: false, error: 'invalid_message' });
      return { sent: false, error: 'invalid_message' };
    }
    const timeoutMs = options.timeoutMs ?? SEND_TIMEOUT_MS;
    const row = await loadSmtp(db);
    if (!row?.host || !row.port || !row.user || !row.passwordEnc) {
      await log(db, options.maskRecipient, { source, to: message.to, subject: message.subject, success: false, error: 'smtp_not_configured' });
      return { sent: false, error: 'smtp_not_configured' };
    }
    let password: string;
    try {
      password = decrypt(row.passwordEnc);
    } catch {
      await log(db, options.maskRecipient, { source, to: message.to, subject: message.subject, success: false, error: 'smtp_password_unreadable' });
      return { sent: false, error: 'smtp_password_unreadable' };
    }
    let target: { connectTo: string; servername?: string };
    try {
      target = await resolveSmtpTarget(row.host);
    } catch (error) {
      const code = error instanceof SmtpHostNotAllowedError ? 'smtp_host_not_allowed' : error instanceof Error ? error.message : String(error);
      await log(db, options.maskRecipient, { source, to: message.to, subject: message.subject, success: false, error: code });
      return { sent: false, error: code.slice(0, MAX_ERROR_LENGTH) };
    }
    const t = emailTranslator(message.locale);
    const unitName = row.unitName || 'CallingSupportApp';
    const html = buildBrandedEmail(message.subject, message.html ?? '', unitName, message.preheader ?? '', {
      signature: t('layout.signature', { unitName }),
      footer: t('layout.footer', { unitName, year: new Date().getFullYear() }),
      notOfficial: MESSAGES[isLocale(message.locale) ? message.locale : 'es'].common.notOfficial,
    });
    const transport = (options.transport ?? defaultTransport)(
      { host: target.connectTo, servername: target.servername, port: row.port, secure: Boolean(row.secure), user: row.user, password },
      timeoutMs,
    );
    await withTimeout(
      transport.sendMail({
        from: { name: unitName, address: row.user },
        to: to.data,
        subject: message.subject,
        html,
        text: message.text,
      }),
      timeoutMs,
    );
    await log(db, options.maskRecipient, { source, to: message.to, subject: message.subject, success: true, error: null });
    return { sent: true };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (db) await log(db, options.maskRecipient, { source, to: message.to, subject: message.subject, success: false, error: text });
    else console.error(JSON.stringify({ event: 'send_mail_failed', name: (error as Error | null)?.name }));
    return { sent: false, error: text.slice(0, MAX_ERROR_LENGTH) };
  }
}

export async function listMailLogs(db: Database) {
  await purgeExpiredMailLogs(db);
  return db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(LOG_LIMIT);
}
