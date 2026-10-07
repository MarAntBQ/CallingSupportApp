import 'server-only';
import { eq, lt, sql } from 'drizzle-orm';
import { rateLimited } from '@/server/auth/errors';
import type { Database } from '@/server/db';
import { rateLimits } from '@/server/db/schema';

export type Limit = { key: string; max: number; windowMs: number };

const MINUTE = 60 * 1000;

export const LIMITS = {
  loginPerEmail: { max: 5, windowMs: 15 * MINUTE },
  loginPerIp: { max: 20, windowMs: 15 * MINUTE },
  setupPerIp: { max: 10, windowMs: 60 * MINUTE },
  changePasswordPerUser: { max: 5, windowMs: 15 * MINUTE },
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

export async function consume(db: Database, limits: Limit[], now = new Date()) {
  for (const limit of limits) {
    const row = await hit(db, limit, now);
    if (row.count > limit.max) throw rateLimited((row.resetAt.getTime() - now.getTime()) / 1000);
  }
}

export async function refund(db: Database, key: string) {
  await db
    .update(rateLimits)
    .set({ count: sql`greatest(${rateLimits.count} - 1, 0)` })
    .where(eq(rateLimits.key, key));
}

export async function clear(db: Database, key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
