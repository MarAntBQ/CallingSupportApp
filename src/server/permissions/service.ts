import 'server-only';
import { and, eq, or, sql } from 'drizzle-orm';
import { GLOBAL_ADMIN_LEVEL, LEADER_LEVEL, MODULES, type ModuleAction, type ModuleKey } from '@/lib/modules';
import { AuthError } from '@/server/auth/errors';
import { toMe, type Session, type SessionUser } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import { callings, modulePermissions, organizations, userCallings } from '@/server/db/schema';

type PermissionUser = Pick<SessionUser, 'id' | 'role'>;

function activeCallingsOf(userId: string) {
  return and(eq(userCallings.userId, userId), eq(callings.active, true), eq(organizations.active, true));
}

export async function moduleActionsOf(db: Database, user: PermissionUser, module: ModuleKey) {
  const none = { read: false, create: false, update: false, delete: false };
  if (user.role.level >= GLOBAL_ADMIN_LEVEL) return { read: true, create: true, update: true, delete: true };
  if (user.role.level < LEADER_LEVEL) return none;
  const [row] = await db
    .select({
      read: sql<boolean>`coalesce(bool_or(${modulePermissions.canRead}), false)`,
      create: sql<boolean>`coalesce(bool_or(${modulePermissions.canCreate}), false)`,
      update: sql<boolean>`coalesce(bool_or(${modulePermissions.canUpdate}), false)`,
      delete: sql<boolean>`coalesce(bool_or(${modulePermissions.canDelete}), false)`,
    })
    .from(userCallings)
    .innerJoin(callings, eq(userCallings.callingId, callings.id))
    .innerJoin(organizations, eq(callings.organizationId, organizations.id))
    .innerJoin(modulePermissions, eq(modulePermissions.callingId, callings.id))
    .where(and(activeCallingsOf(user.id), eq(modulePermissions.module, module)));
  return row ?? none;
}

export async function allowedModules(db: Database, user: PermissionUser): Promise<ModuleKey[]> {
  if (user.role.level >= GLOBAL_ADMIN_LEVEL) return [...MODULES];
  if (user.role.level < LEADER_LEVEL) return [];
  const rows = await db
    .selectDistinct({ module: modulePermissions.module })
    .from(userCallings)
    .innerJoin(callings, eq(userCallings.callingId, callings.id))
    .innerJoin(organizations, eq(callings.organizationId, organizations.id))
    .innerJoin(modulePermissions, eq(modulePermissions.callingId, callings.id))
    .where(
      and(
        activeCallingsOf(user.id),
        or(modulePermissions.canRead, modulePermissions.canCreate, modulePermissions.canUpdate, modulePermissions.canDelete),
      ),
    );
  const granted = new Set(rows.map((row) => row.module));
  return MODULES.filter((module) => granted.has(module));
}

export async function assertModulePermission(db: Database, session: Session, module: ModuleKey, action: ModuleAction) {
  const { level } = session.user.role;
  if (level >= GLOBAL_ADMIN_LEVEL) return session;
  if (level < LEADER_LEVEL) throw new AuthError(403, 'no_admin_calling');
  const actions = await moduleActionsOf(db, session.user, module);
  if (!actions[action]) throw new AuthError(403, 'forbidden');
  return session;
}

export async function meOf(db: Database, session: Session) {
  return toMe(session, await allowedModules(db, session.user));
}
