import 'server-only';
import { and, count, eq, gt, gte, isNull } from 'drizzle-orm';
import { GLOBAL_ADMIN_LEVEL, MODULES, type ModuleKey } from '@/lib/modules';
import type { Database } from '@/server/db';
import { roles, sessions, users } from '@/server/db/schema';
import { generateSessionToken, hashSessionToken } from './crypto';
import { AuthError } from './errors';

export const SESSION_COOKIE = 'csa_session';
export const SESSION_TTL_MS = 60 * 60 * 1000;
export const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  locale: string | null;
  role: { key: string; name: string; level: number };
};

export type Session = { id: string; expiresAt: Date; user: SessionUser };

export type Me = Omit<SessionUser, 'locale'> & { allowedModules: ModuleKey[] };

export async function createSession(
  db: Database,
  userId: string,
  options: { rememberMe?: boolean; userAgent?: string | null; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + (options.rememberMe ? REMEMBER_TTL_MS : SESSION_TTL_MS));
  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent: options.userAgent?.slice(0, 512) ?? null,
  });
  return { token, expiresAt };
}

export async function findSession(db: Database, token: string | null | undefined, now = new Date()) {
  if (!token) return null;
  const [row] = await db
    .select({
      id: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      locale: users.locale,
      roleKey: roles.key,
      roleName: roles.name,
      roleLevel: roles.level,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      locale: row.locale,
      role: { key: row.roleKey, name: row.roleName, level: row.roleLevel },
    },
  } satisfies Session;
}

export async function revokeSession(db: Database, sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export function isGlobalAdmin(session: Session) {
  return session.user.role.level >= GLOBAL_ADMIN_LEVEL;
}

export function assertGlobalAdmin(session: Session) {
  if (!isGlobalAdmin(session)) throw new AuthError(403, 'forbidden');
  return session;
}

export function toMe(session: Session): Me {
  const { id, firstName, lastName, email, phone, role } = session.user;
  return {
    id,
    firstName,
    lastName,
    email,
    phone,
    role: { key: role.key, name: role.name, level: role.level },
    allowedModules: isGlobalAdmin(session) ? [...MODULES] : [],
  };
}

export async function countActiveAdmins(db: Database) {
  const [row] = await db
    .select({ total: count() })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.status, 'active'), gte(roles.level, GLOBAL_ADMIN_LEVEL)));
  return row?.total ?? 0;
}
