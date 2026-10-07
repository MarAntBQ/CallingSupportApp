import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { setApproval } from '@/server/temple-trips/registrations';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = z.strictObject({ approved: z.boolean() }).safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await setApproval(getDb(), id.data, body.data.approved);
    if (!result.ok) {
      if (result.status === 404) throw new AuthError(404, 'not_found');
      return NextResponse.json(
        { error: 'invalid_input', fields: [result.resource], issues: [{ field: result.resource, code: 'no_quota' }] },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'temple-trips', action: 'update' } },
);
