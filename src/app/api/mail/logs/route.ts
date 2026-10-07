import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { listMailLogs } from '@/server/mail/service';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth(async () => NextResponse.json(await listMailLogs(getDb())), { permission: 'global-admin' });
