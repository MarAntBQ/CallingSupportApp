import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assignRoomSchema } from '@/lib/validation/rooms';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { assignRoom } from '@/server/temple-trips/rooms';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = assignRoomSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await assignRoom(getDb(), id.data, body.data.roomId, body.data.role);
    if (!result.ok) {
      if (result.status === 404) throw new AuthError(404, 'not_found');
      return NextResponse.json({ error: 'invalid_input', fields: ['roomId'], issues: [{ field: 'roomId', code: result.code }] }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'temple-trips', action: 'update' } },
);
