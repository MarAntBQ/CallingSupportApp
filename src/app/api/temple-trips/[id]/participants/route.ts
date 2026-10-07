import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { listTripParticipants } from '@/server/temple-trips/registrations';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, { session, params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    return NextResponse.json(await listTripParticipants(getDb(), id.data, { includeIp: isGlobalAdmin(session) }));
  },
  { permission: { module: 'temple-trips', action: 'read' } },
);
