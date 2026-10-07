import { NextResponse } from 'next/server';
import { revokeOtherSessions } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (_request, { session }) => {
  const revoked = await revokeOtherSessions(getDb(), session.user.id, session.id);
  return NextResponse.json({ revoked });
});
