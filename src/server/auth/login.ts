import 'server-only';
import { eq } from 'drizzle-orm';
import type { Database } from '@/server/db';
import { users } from '@/server/db/schema';
import { verifyPassword } from './crypto';
import { AuthError } from './errors';

export async function authenticate(db: Database, email: string, password: string) {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, status: users.status, locale: users.locale, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk) throw new AuthError(401, 'invalid_credentials');
  if (user.status === 'pending') throw new AuthError(403, 'account_pending');
  if (user.status === 'suspended') throw new AuthError(403, 'account_suspended');
  return { id: user.id, locale: user.locale, passwordHash: user.passwordHash, mfaEnabled: user.mfaEnabled };
}
