import { NextResponse } from 'next/server';
import { z } from 'zod';
import { campSchema } from '@/lib/validation/camps';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { updateCamp } from '@/server/camps/camps';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params, session }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = campSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const camp = await updateCamp(getDb(), id.data, body.data, session.user.id);
    if (!camp) throw new AuthError(404, 'not_found');
    return NextResponse.json(camp);
  },
  { permission: { module: 'camps', action: 'update' } },
);
