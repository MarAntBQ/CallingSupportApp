import 'server-only';
import type { ModuleAction, ModuleKey } from '@/lib/modules';
import { assertGlobalAdmin, type Session } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { assertModulePermission } from '@/server/permissions/service';

export type Permission = 'global-admin' | { module: ModuleKey; action: ModuleAction };

export async function assertPermission(session: Session, permission: Permission | undefined) {
  if (!permission) return session;
  if (permission === 'global-admin') return assertGlobalAdmin(session);
  return assertModulePermission(getDb(), session, permission.module, permission.action);
}
