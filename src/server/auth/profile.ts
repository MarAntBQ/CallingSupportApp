import 'server-only';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { ChangePasswordInput, ProfileInput } from '@/lib/validation/profile';
import type { Database } from '@/server/db';
import { sessions, users } from '@/server/db/schema';
import { hashPassword, verifyPassword } from './crypto';
import type { Session } from './sessions';

export async function updateProfile(db: Database, userId: string, input: ProfileInput) {
  await db
    .update(users)
    .set({
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.phone !== undefined && { phone: input.phone }),
    })
    .where(eq(users.id, userId));
}

export async function changePassword(
  db: Database,
  session: Session,
  input: ChangePasswordInput,
  hooks: { afterVerify?: () => Promise<void> } = {},
) {
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) return { ok: false as const };
  await hooks.afterVerify?.();

  const passwordHash = await hashPassword(input.newPassword);
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .for('update')
      .limit(1);
    if (locked?.passwordHash !== user.passwordHash) return { ok: false as const };
    await tx.update(users).set({ passwordHash }).where(eq(users.id, session.user.id));
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, session.user.id), ne(sessions.id, session.id), isNull(sessions.revokedAt)));
    return { ok: true as const };
  });
}
