import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { listWardCouncil } from '@/server/users/users';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await listWardCouncil(getDb())), { permission: { module: 'users', action: 'read' } });
