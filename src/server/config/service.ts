import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { isLocale } from '@/i18n/config';
import type { ConfigInput, PublicConfig } from '@/lib/validation/config';
import type { Database } from '@/server/db';
import { appConfig } from '@/server/db/schema';

type ConfigRow = typeof appConfig.$inferSelect;

const DEFAULT_ROW: Omit<ConfigRow, 'updatedAt'> = {
  id: 1,
  unitName: '',
  allowRegistration: false,
  logoDataUrl: null,
  timezone: 'America/Guayaquil',
  defaultLocale: 'es',
  contact: null,
  controllerName: null,
  controllerEmail: null,
  controllerPhone: null,
  controllerAddress: null,
  controllerCity: null,
  controllerWebsite: null,
  retentionMonths: 12,
  policyVersion: '2026-10',
};

export function toPublicConfig(row: Omit<ConfigRow, 'updatedAt'>): PublicConfig {
  return {
    unitName: row.unitName,
    allowRegistration: row.allowRegistration,
    logoDataUrl: row.logoDataUrl,
    timezone: row.timezone,
    defaultLocale: isLocale(row.defaultLocale) ? row.defaultLocale : 'es',
    contact: row.contact,
    controller: {
      name: row.controllerName,
      email: row.controllerEmail,
      phone: row.controllerPhone,
      address: row.controllerAddress,
      city: row.controllerCity,
      website: row.controllerWebsite,
    },
    retentionMonths: row.retentionMonths,
    policyVersion: row.policyVersion,
  };
}

export async function getConfig(db: Database): Promise<PublicConfig> {
  const [row] = await db.select().from(appConfig).where(eq(appConfig.id, 1)).limit(1);
  return toPublicConfig(row ?? DEFAULT_ROW);
}

async function upsert(db: Database, values: Partial<Omit<ConfigRow, 'id' | 'updatedAt'>>) {
  const [row] = await db
    .insert(appConfig)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: appConfig.id, set: { ...values, updatedAt: sql`now()` } })
    .returning();
  return toPublicConfig(row!);
}

export function updateConfig(db: Database, input: ConfigInput) {
  return upsert(db, {
    unitName: input.unitName,
    allowRegistration: input.allowRegistration,
    timezone: input.timezone,
    defaultLocale: input.defaultLocale,
    contact: input.contact,
    controllerName: input.controller.name,
    controllerEmail: input.controller.email,
    controllerPhone: input.controller.phone,
    controllerAddress: input.controller.address,
    controllerCity: input.controller.city,
    controllerWebsite: input.controller.website,
    retentionMonths: input.retentionMonths,
    policyVersion: input.policyVersion,
  });
}

export function setLogo(db: Database, logoDataUrl: string | null) {
  return upsert(db, { logoDataUrl });
}
