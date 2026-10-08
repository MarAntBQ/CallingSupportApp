import { NextResponse } from 'next/server';
import { z } from 'zod';
import { backgroundMailer } from '@/server/auth/background-mail';
import { AuthError } from '@/server/auth/errors';
import { resetUserMfa } from '@/server/auth/mfa';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

// Solo SuperAdmin (con su propia verificación activa): para quien perdió el teléfono y sus códigos.
export const POST = withAuth<{ id: string }>(
  async (_request, { session, params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    await resetUserMfa(getDb(), session, id.data, { mailer: backgroundMailer });
    return new NextResponse(null, { status: 204 });
  },
  { permission: 'global-admin' },
);
