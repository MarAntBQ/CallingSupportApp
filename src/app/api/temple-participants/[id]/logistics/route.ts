import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logisticsPatchSchema } from '@/lib/validation/registrations';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { updateLogistics } from '@/server/temple-trips/registrations';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = logisticsPatchSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await updateLogistics(getDb(), id.data, body.data);
    if (!result.ok) throw new AuthError(404, 'not_found');
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'temple-trips', action: 'update' } },
);
