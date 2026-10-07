import 'server-only';
import { eq, sql } from 'drizzle-orm';
import type { SmtpInput, SmtpSummary } from '@/lib/validation/smtp';
import { encrypt } from '@/server/crypto/aes';
import type { Database } from '@/server/db';
import { appConfig } from '@/server/db/schema';

export async function getSmtpSummary(db: Database): Promise<SmtpSummary> {
  const [row] = await db
    .select({
      host: appConfig.smtpHost,
      port: appConfig.smtpPort,
      secure: appConfig.smtpSecure,
      user: appConfig.smtpUser,
      hasPassword: sql<boolean>`${appConfig.smtpPasswordEnc} is not null`,
    })
    .from(appConfig)
    .where(eq(appConfig.id, 1))
    .limit(1);
  return {
    host: row?.host ?? null,
    port: row?.port ?? null,
    secure: Boolean(row?.secure),
    user: row?.user ?? null,
    hasPassword: Boolean(row?.hasPassword),
  };
}

export async function saveSmtp(db: Database, input: SmtpInput) {
  const values = {
    smtpHost: input.host,
    smtpPort: input.port,
    smtpSecure: input.secure,
    smtpUser: input.user,
    ...(input.password !== undefined && { smtpPasswordEnc: encrypt(input.password) }),
  };
  await db
    .insert(appConfig)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: appConfig.id, set: { ...values, updatedAt: sql`now()` } });
  return getSmtpSummary(db);
}
