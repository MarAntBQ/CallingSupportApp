import 'server-only';
import { and, eq, gte } from 'drizzle-orm';
import { isLocale, type Locale } from '@/i18n/config';
import { LEADER_LEVEL, type ModuleKey } from '@/lib/modules';
import { getDb, type Database } from '@/server/db';
import { appConfig, callings, modulePermissions, organizations, roles, userCallings, users } from '@/server/db/schema';
import { sendMail, type MailMessage } from '@/server/mail/service';
import { telegramSenderFor, type TelegramSender } from '@/server/telegram/service';

/**
 * Contenido de un aviso de módulo en un idioma. Por las pautas de recursos en línea
 * (Manual General 38.8.21.2) es solo un resumen corto, sin nombres, teléfonos ni correos,
 * y el enlace al panel: el detalle se ve dentro de la aplicación.
 */
export type ModuleNotice = { subject: string; html: string; telegramText: string };

export type NoticeBuilder = (locale: Locale) => ModuleNotice;

type Mailer = (source: string, message: MailMessage) => Promise<unknown>;

export type NotifyOptions = { db?: Database; mailer?: Mailer; telegramSender?: TelegramSender | null };

export type NotifyResult = { recipients: number; sent: number };

export async function moduleNotificationRecipients(db: Database, module: ModuleKey) {
  const rows = await db
    .selectDistinct({ id: users.id, email: users.email, locale: users.locale, telegramChatId: users.telegramChatId })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(userCallings, eq(userCallings.userId, users.id))
    .innerJoin(callings, eq(userCallings.callingId, callings.id))
    .innerJoin(organizations, eq(callings.organizationId, organizations.id))
    .innerJoin(modulePermissions, eq(modulePermissions.callingId, callings.id))
    .where(
      and(
        eq(users.status, 'active'),
        gte(roles.level, LEADER_LEVEL),
        eq(callings.active, true),
        eq(organizations.active, true),
        eq(modulePermissions.module, module),
        eq(modulePermissions.canNotify, true),
      ),
    );
  return rows;
}

/**
 * Envía el aviso de un módulo a quienes tienen "Notificar" en ese módulo: un correo por
 * destinatario (nadie ve la dirección de los demás), en el idioma de cada uno. Nunca lanza.
 *
 * Punto de extensión para Telegram (#17): cuando exista el vínculo de cada usuario, enviar
 * `notice.telegramText` aquí mismo, por destinatario, igual que el correo.
 */
export async function notifyModuleEvent(module: ModuleKey, build: NoticeBuilder, options: NotifyOptions = {}): Promise<NotifyResult> {
  try {
    const db = options.db ?? getDb();
    const mailer: Mailer = options.mailer ?? ((source, message) => sendMail(source, message, { db }));
    const telegramSender: TelegramSender | null = options.telegramSender !== undefined ? options.telegramSender : await telegramSenderFor(db);
    const [config] = await db.select({ defaultLocale: appConfig.defaultLocale }).from(appConfig).limit(1);
    const fallback: Locale = isLocale(config?.defaultLocale) ? config.defaultLocale : 'es';
    const recipients = await moduleNotificationRecipients(db, module);
    const notices = new Map<Locale, ModuleNotice>();
    let sent = 0;
    for (const recipient of recipients) {
      const locale: Locale = isLocale(recipient.locale) ? recipient.locale : fallback;
      let notice = notices.get(locale);
      if (!notice) {
        notice = build(locale);
        notices.set(locale, notice);
      }
      try {
        const result = await mailer(module, {
          to: recipient.email,
          subject: notice.subject,
          html: notice.html,
          text: notice.telegramText,
          locale,
        });
        if ((result as { sent?: boolean } | null)?.sent !== false) sent += 1;
      } catch (error) {
        console.error(JSON.stringify({ event: 'module_notice_failed', module, name: (error as Error | null)?.name }));
      }
      // Aviso por Telegram a quien lo tenga vinculado (solo resumen + enlace; nunca PII). No lanza.
      if (telegramSender && recipient.telegramChatId) {
        try {
          await telegramSender(recipient.telegramChatId, notice.telegramText);
        } catch (error) {
          console.error(JSON.stringify({ event: 'module_notice_telegram_failed', module, name: (error as Error | null)?.name }));
        }
      }
    }
    return { recipients: recipients.length, sent };
  } catch (error) {
    console.error(JSON.stringify({ event: 'module_notice_failed', module, name: (error as Error | null)?.name }));
    return { recipients: 0, sent: 0 };
  }
}
