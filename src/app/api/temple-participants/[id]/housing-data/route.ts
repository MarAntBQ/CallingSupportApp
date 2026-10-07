import { NextResponse } from 'next/server';
import { z } from 'zod';
import { housingDataSchema } from '@/lib/validation/rooms';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { updateHousingData } from '@/server/temple-trips/rooms';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = housingDataSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const ok = await updateHousingData(getDb(), id.data, body.data);
    if (!ok) throw new AuthError(404, 'not_found');
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'temple-trips', action: 'update' } },
);
