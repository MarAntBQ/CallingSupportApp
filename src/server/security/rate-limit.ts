import 'server-only';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { rateLimited } from '@/server/auth/errors';
import type { Database } from '@/server/db';
import { rateLimits } from '@/server/db/schema';

export type Limit = { key: string; max: number; windowMs: number };

const MINUTE = 60 * 1000;

export const LIMITS = {
  loginPerEmail: { max: 5, windowMs: 15 * MINUTE },
  loginPerIp: { max: 20, windowMs: 15 * MINUTE },
  setupPerIp: { max: 10, windowMs: 60 * MINUTE },
} as const;

export async function hit(db: Database, { key, windowMs }: Pick<Limit, 'key' | 'windowMs'>, now = new Date()) {
  const resetAt = new Date(now.getTime() + windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${now} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
  return row!;
}

export async function assertNotLimited(db: Database, limits: Pick<Limit, 'key' | 'max'>[], now = new Date()) {
  for (const { key, max } of limits) {
    const [row] = await db
      .select({ count: rateLimits.count, resetAt: rateLimits.resetAt })
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), gt(rateLimits.resetAt, now)))
      .limit(1);
    if (row && row.count >= max) throw rateLimited((row.resetAt.getTime() - now.getTime()) / 1000);
  }
}

export async function clear(db: Database, key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
