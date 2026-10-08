import { NextResponse } from 'next/server';
import { AuthError } from '@/server/auth/errors';
import { parseId } from '@/server/camps/http';
import { listParticipants } from '@/server/camps/participants';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const participants = await listParticipants(getDb(), parseId(params.id));
    if (!participants) throw new AuthError(404, 'not_found');
    return NextResponse.json(participants);
  },
  { permission: { module: 'camps', action: 'read' } },
);
