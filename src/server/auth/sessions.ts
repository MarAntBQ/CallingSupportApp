import 'server-only';
import { and, count, desc, eq, gt, gte, isNull, lt, ne, or } from 'drizzle-orm';
import { GLOBAL_ADMIN_LEVEL, type ModuleKey } from '@/lib/modules';
import type { Database } from '@/server/db';
import { roles, sessions, users } from '@/server/db/schema';
import { generateSessionToken, hashSessionToken } from './crypto';
import { AuthError } from './errors';

export const SESSION_TTL_MS = 60 * 60 * 1000;
export const REMEMBER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function sessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-csa_session' : 'csa_session';
}

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
  db: Pick<Database, 'insert'>,
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

export async function createLoginSession(
  db: Database,
  userId: string,
  verifiedCredential: string,
  options: { rememberMe?: boolean; userAgent?: string | null; replacesSessionId?: string } = {},
) {
  const { replacesSessionId, ...sessionOptions } = options;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .for('share')
      .limit(1);
    if (!row || row.passwordHash !== verifiedCredential) throw new AuthError(401, 'invalid_credentials');
    if (replacesSessionId) {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.id, replacesSessionId), isNull(sessions.revokedAt)));
    }
    return createSession(tx, userId, sessionOptions);
  });
}

export async function findSession(db: Database, token: string | null | undefined, now = new Date()) {
  if (!token) return null;
  const [row] = await db
    .select({
      id: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
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
        gt(sessions.lastSeenAt, new Date(now.getTime() - IDLE_TIMEOUT_MS)),
        eq(users.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(and(eq(sessions.id, row.id), lt(sessions.lastSeenAt, now)));
  }
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

// Sesión activa para el panel del SuperAdmin. Nunca expone el hash del token.
export type SessionListItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
};

// Sesiones no revocadas y no vencidas, de la más nueva a la más vieja.
export async function listActiveSessions(db: Database, now = new Date()): Promise<SessionListItem[]> {
  const rows = await db
    .select({
      id: sessions.id,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.createdAt));
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: `${row.firstName} ${row.lastName}`,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    userAgent: row.userAgent,
  }));
}

// Revoca una sesión por id; devuelve false si no existe (404). Idempotente si ya está revocada.
export async function revokeSessionChecked(db: Database, sessionId: string, now = new Date()): Promise<boolean> {
  const [row] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!row) return false;
  await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  return true;
}

// Revoca todas las sesiones del usuario MENOS la actual; devuelve cuántas revocó.
export async function revokeOtherSessions(db: Database, userId: string, exceptSessionId: string, now = new Date()): Promise<number> {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return revoked.length;
}

// Revoca TODAS las sesiones vivas de un usuario (al suspenderlo o restablecer su contraseña, #16).
export async function revokeAllUserSessions(db: Database, userId: string, now = new Date()): Promise<number> {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return revoked.length;
}

// Limpieza técnica (#26): borra las sesiones vencidas o revocadas hace más de 30 días. Las filas
// recién revocadas se conservan un tiempo por si hace falta auditar; pasado el umbral, se van.
export async function purgeStaleSessions(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, cutoff), lt(sessions.revokedAt, cutoff)))
    .returning({ id: sessions.id });
  return deleted.length;
}

export function isGlobalAdmin(session: Session) {
  return session.user.role.level >= GLOBAL_ADMIN_LEVEL;
}

export function assertGlobalAdmin(session: Session) {
  if (!isGlobalAdmin(session)) throw new AuthError(403, 'forbidden');
  return session;
}

export function toMe(session: Session, allowedModules: ModuleKey[]): Me {
  const { id, firstName, lastName, email, phone, role } = session.user;
  return {
    id,
    firstName,
    lastName,
    email,
    phone,
    role: { key: role.key, name: role.name, level: role.level },
    allowedModules,
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
