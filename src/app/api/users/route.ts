import { NextResponse } from 'next/server';
import { createUserSchema } from '@/lib/validation/users';
import { invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { createUser, listUsers } from '@/server/users/users';

export const dynamic = 'force-dynamic';

const FIELD_BY_CODE = { email_taken: 'email', role_not_found: 'roleId', invalid_calling: 'callingIds' } as const;

export const GET = withAuth(async () => NextResponse.json(await listUsers(getDb())), { permission: { module: 'users', action: 'read' } });

export const POST = withAuth(
  async (request) => {
    const body = createUserSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await createUser(getDb(), body.data, { baseUrl: new URL(request.url).origin });
    if (!result.ok) {
      const field = FIELD_BY_CODE[result.code];
      return NextResponse.json({ error: 'invalid_input', fields: [field], issues: [{ field, code: result.code }] }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  },
  { permission: { module: 'users', action: 'create' } },
);
