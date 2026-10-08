import { NextResponse } from 'next/server';
import { campSchema } from '@/lib/validation/camps';
import { invalidInputResponse } from '@/server/auth/errors';
import { createCamp, listCamps } from '@/server/camps/camps';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await listCamps(getDb())), {
  permission: { module: 'camps', action: 'read' },
});

export const POST = withAuth(
  async (request, { session }) => {
    const body = campSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    return NextResponse.json(await createCamp(getDb(), body.data, session.user.id), { status: 201 });
  },
  { permission: { module: 'camps', action: 'create' } },
);
