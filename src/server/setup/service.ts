import 'server-only';
import { count, eq, sql } from 'drizzle-orm';
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy';
import type { SetupInput } from '@/lib/validation/auth';
import { hashPassword } from '@/server/auth/crypto';
import { AuthError } from '@/server/auth/errors';
import type { Database } from '@/server/db';
import { installation, roles, users } from '@/server/db/schema';

export async function isSetupNeeded(db: Database) {
  const [row] = await db.select({ total: count() }).from(users);
  return (row?.total ?? 0) === 0;
}

export async function performSetup(
  db: Database,
  input: SetupInput,
  hooks: { afterCheck?: () => Promise<void> } = {},
) {
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${users} in exclusive mode`);

    const [existing] = await tx.select({ total: count() }).from(users);
    if ((existing?.total ?? 0) > 0) throw new AuthError(404, 'not_found');
    await hooks.afterCheck?.();

    const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, 'super_admin')).limit(1);
    if (!role) throw new Error('Falta el rol super_admin: corre las migraciones.');

    const [user] = await tx
      .insert(users)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        roleId: role.id,
        status: 'active',
        locale: input.locale,
        consentAt: sql`now()`,
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
        consentLocale: input.locale,
      })
      .returning({ id: users.id });

    await tx.insert(installation).values({
      bishopApprovedBy: input.bishopApprovedBy,
      bishopApprovedOn: input.bishopApprovedOn,
    });

    return { userId: user!.id };
  });
}
