import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateUserSchema } from '@/lib/validation/users';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { updateUser } from '@/server/users/users';

export const dynamic = 'force-dynamic';

const FIELD_BY_CODE = { role_not_found: 'roleId', invalid_calling: 'callingIds' } as const;

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = updateUserSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await updateUser(getDb(), id.data, body.data);
    if (!result.ok) {
      if (result.status === 404) throw new AuthError(404, 'not_found');
      const field = FIELD_BY_CODE[result.code];
      return NextResponse.json({ error: 'invalid_input', fields: [field], issues: [{ field, code: result.code }] }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'users', action: 'update' } },
);
