import { NextResponse } from 'next/server';
import { moduleKeySchema, modulePermissionsSchema } from '@/lib/validation/module-permissions';
import { invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { getPermissionMatrix, setModulePermissions } from '@/server/permissions/matrix';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const PUT = withAuth<{ module: string }>(
  async (request, { params }) => {
    const moduleKey = moduleKeySchema.safeParse(params.module);
    if (!moduleKey.success) {
      return NextResponse.json({ error: 'invalid_input', fields: ['module'], issues: [] }, { status: 400 });
    }
    const body = modulePermissionsSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const db = getDb();
    const result = await setModulePermissions(db, moduleKey.data, body.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'invalid_input', fields: ['permissions'], issues: [{ field: 'permissions', code: 'unknown_calling' }] },
        { status: 400 },
      );
    }
    return NextResponse.json((await getPermissionMatrix(db))[moduleKey.data]);
  },
  { permission: { module: 'permissions', action: 'update' } },
);
