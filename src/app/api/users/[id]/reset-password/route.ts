import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { resetPassword } from '@/server/users/users';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const result = await resetPassword(getDb(), id.data);
    if (!result.ok) throw new AuthError(404, 'not_found');
    return NextResponse.json({ password: result.password });
  },
  { permission: { module: 'users', action: 'update' } },
);
