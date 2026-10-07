import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { deleteRoom } from '@/server/temple-trips/rooms';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const ok = await deleteRoom(getDb(), id.data);
    if (!ok) throw new AuthError(404, 'not_found');
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'temple-trips', action: 'delete' } },
);
