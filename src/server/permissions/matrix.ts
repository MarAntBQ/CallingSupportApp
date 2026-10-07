import 'server-only';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { MODULES, type ModuleKey } from '@/lib/modules';
import { PERMISSION_FLAGS, type MatrixRow, type ModulePermissionsInput, type PermissionMatrix } from '@/lib/validation/module-permissions';
import type { Database } from '@/server/db';
import { callings, modulePermissions, organizations } from '@/server/db/schema';

export async function getPermissionMatrix(db: Database): Promise<PermissionMatrix> {
  const [catalog, stored] = await Promise.all([
    db
      .select({
        callingId: callings.id,
        callingName: callings.name,
        organizationName: organizations.name,
        callingActive: callings.active,
        organizationActive: organizations.active,
      })
      .from(callings)
      .innerJoin(organizations, eq(callings.organizationId, organizations.id))
      .orderBy(asc(organizations.name), asc(callings.name)),
    db.select().from(modulePermissions),
  ]);
  const byKey = new Map(stored.map((row) => [`${row.module}:${row.callingId}`, row]));
  const matrix = {} as PermissionMatrix;
  for (const key of MODULES) {
    matrix[key] = catalog.map((calling): MatrixRow => {
      const row = byKey.get(`${key}:${calling.callingId}`);
      return {
        callingId: calling.callingId,
        callingName: calling.callingName,
        organizationName: calling.organizationName,
        active: calling.callingActive && calling.organizationActive,
        canRead: row?.canRead ?? false,
        canCreate: row?.canCreate ?? false,
        canUpdate: row?.canUpdate ?? false,
        canDelete: row?.canDelete ?? false,
        canNotify: row?.canNotify ?? false,
      };
    });
  }
  return matrix;
}

export type SetMatrixResult = { ok: true } | { ok: false; reason: 'unknown_calling' };

export async function setModulePermissions(
  db: Database,
  module: ModuleKey,
  input: ModulePermissionsInput,
): Promise<SetMatrixResult> {
  const rows = input.permissions.filter((row) => PERMISSION_FLAGS.some((flag) => row[flag]));
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('module-permissions'), hashtext(${module}))`);
    if (rows.length > 0) {
      const ids = rows.map((row) => row.callingId);
      const found = await tx.select({ id: callings.id }).from(callings).where(inArray(callings.id, ids)).for('share');
      if (found.length !== new Set(ids).size) return { ok: false, reason: 'unknown_calling' } as const;
    }
    await tx.delete(modulePermissions).where(eq(modulePermissions.module, module));
    if (rows.length > 0) await tx.insert(modulePermissions).values(rows.map((row) => ({ module, ...row })));
    return { ok: true } as const;
  });
}

