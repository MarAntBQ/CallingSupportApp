import { NextResponse } from 'next/server';
import { participantPatchSchema } from '@/lib/validation/camps';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { parseId } from '@/server/camps/http';
import { updateParticipant } from '@/server/camps/participants';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params, session }) => {
    const id = parseId(params.id);
    const body = participantPatchSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await updateParticipant(getDb(), id, body.data, session.user.id);
    if (!result.ok && result.status === 404) throw new AuthError(404, 'not_found');
    if (!result.ok) return NextResponse.json({ error: 'invalid_input', fields: ['gender'], issues: [{ field: 'gender', code: result.code }] }, { status: 409 });
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'camps', action: 'update' } },
);
