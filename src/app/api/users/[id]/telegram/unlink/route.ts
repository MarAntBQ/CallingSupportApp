import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { unlinkTelegram } from '@/server/telegram/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    await unlinkTelegram(getDb(), id.data);
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'users', action: 'update' } },
);
