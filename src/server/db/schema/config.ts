import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';

export const appConfig = pgTable(
  'app_config',
  {
    id: smallint('id').primaryKey().default(1),
    unitName: text('unit_name').notNull().default(''),
    allowRegistration: boolean('allow_registration').notNull().default(false),
    logoDataUrl: text('logo_data_url'),
    timezone: text('timezone').notNull().default('America/Guayaquil'),
    defaultLocale: text('default_locale').notNull().default('es'),
    contact: text('contact'),
    controllerName: text('controller_name'),
    controllerEmail: text('controller_email'),
    controllerPhone: text('controller_phone'),
    controllerAddress: text('controller_address'),
    controllerCity: text('controller_city'),
    controllerWebsite: text('controller_website'),
    retentionMonths: integer('retention_months').notNull().default(12),
    policyVersion: text('policy_version').notNull().default('2026-10'),
    defaultNationality: text('default_nationality').notNull().default(''),
    smtpHost: text('smtp_host'),
    smtpPort: integer('smtp_port'),
    smtpSecure: boolean('smtp_secure'),
    smtpUser: text('smtp_user'),
    smtpPasswordEnc: text('smtp_password_enc'),
    // Bot de Telegram (#17): token y secreto del webhook cifrados (AES, utilidad de #10).
    telegramBotTokenEnc: text('telegram_bot_token_enc'),
    telegramBotUsername: text('telegram_bot_username'),
    telegramWebhookSecretEnc: text('telegram_webhook_secret_enc'),
    // #36: exigir la verificación en dos pasos a todo usuario con algún módulo permitido.
    requireMfaForLeaders: boolean('require_mfa_for_leaders').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('app_config_single_row', sql`${table.id} = 1`),
    check('app_config_default_locale_valid', sql`${table.defaultLocale} in ('es', 'pt', 'en')`),
    check('app_config_retention_months_range', sql`${table.retentionMonths} between 1 and 120`),
    check('app_config_smtp_port_range', sql`${table.smtpPort} is null or ${table.smtpPort} between 1 and 65535`),
    check('app_config_logo_size', sql`${table.logoDataUrl} is null or char_length(${table.logoDataUrl}) <= 3000000`),
    check(
      'app_config_controller_email_lowercase',
      sql`${table.controllerEmail} is null or ${table.controllerEmail} = lower(${table.controllerEmail})`,
    ),
  ],
);
