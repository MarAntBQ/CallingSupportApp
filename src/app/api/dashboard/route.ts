import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getDashboard } from '@/server/dashboard/dashboard';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await getDashboard(getDb())), { permission: 'global-admin' });
