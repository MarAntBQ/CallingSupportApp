import { NextResponse } from 'next/server';
import { z } from 'zod';
import { templeTripSchema } from '@/lib/validation/temple-trips';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { updateTempleTrip } from '@/server/temple-trips/trips';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = templeTripSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await updateTempleTrip(getDb(), id.data, body.data);
    if (!result.ok) throw new AuthError(404, 'not_found');
    return NextResponse.json(result.trip);
  },
  { permission: { module: 'temple-trips', action: 'update' } },
);
