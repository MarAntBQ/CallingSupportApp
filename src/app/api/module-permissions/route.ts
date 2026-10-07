import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getPermissionMatrix } from '@/server/permissions/matrix';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await getPermissionMatrix(getDb())), {
  permission: { module: 'permissions', action: 'read' },
});
