import { NextResponse } from 'next/server';
import { templeTripSchema } from '@/lib/validation/temple-trips';
import { invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { createTempleTrip, listTempleTrips } from '@/server/temple-trips/trips';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await listTempleTrips(getDb())), {
  permission: { module: 'temple-trips', action: 'read' },
});

export const POST = withAuth(
  async (request) => {
    const body = templeTripSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    return NextResponse.json(await createTempleTrip(getDb(), body.data), { status: 201 });
  },
  { permission: { module: 'temple-trips', action: 'create' } },
);
