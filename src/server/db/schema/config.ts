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
    controllerCity: text('controller_city'),
    controllerWebsite: text('controller_website'),
    retentionMonths: integer('retention_months').notNull().default(12),
    policyVersion: text('policy_version').notNull().default('2026-10'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('app_config_single_row', sql`${table.id} = 1`),
    check('app_config_default_locale_valid', sql`${table.defaultLocale} in ('es', 'pt', 'en')`),
    check('app_config_retention_months_range', sql`${table.retentionMonths} between 1 and 120`),
    check('app_config_logo_size', sql`${table.logoDataUrl} is null or char_length(${table.logoDataUrl}) <= 3000000`),
    check(
      'app_config_controller_email_lowercase',
      sql`${table.controllerEmail} is null or ${table.controllerEmail} = lower(${table.controllerEmail})`,
    ),
  ],
);
