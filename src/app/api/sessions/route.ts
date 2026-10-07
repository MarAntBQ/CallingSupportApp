import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { listActiveSessions } from '@/server/auth/sessions';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async () => NextResponse.json(await listActiveSessions(getDb())),
  { permission: 'global-admin' },
);
