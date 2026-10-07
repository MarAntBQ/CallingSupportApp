import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { revokeSessionChecked } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const ok = await revokeSessionChecked(getDb(), id.data);
    if (!ok) throw new AuthError(404, 'not_found');
    return NextResponse.json({ ok: true });
  },
  { permission: 'global-admin' },
);
