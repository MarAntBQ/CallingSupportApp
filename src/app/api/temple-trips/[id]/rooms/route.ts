import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRoomSchema } from '@/lib/validation/rooms';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { createRoom, listRooms } from '@/server/temple-trips/rooms';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const view = await listRooms(getDb(), id.data);
    if (!view) throw new AuthError(404, 'not_found');
    return NextResponse.json(view);
  },
  { permission: { module: 'temple-trips', action: 'read' } },
);

export const POST = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = createRoomSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await createRoom(getDb(), id.data, body.data.number);
    if (!result.ok) {
      if (result.status === 404) throw new AuthError(404, 'not_found');
      return NextResponse.json({ error: 'invalid_input', fields: ['number'], issues: [{ field: 'number', code: result.code }] }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  },
  { permission: { module: 'temple-trips', action: 'create' } },
);
