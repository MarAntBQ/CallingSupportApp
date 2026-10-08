import { NextResponse } from 'next/server';
import { resourceSchema } from '@/lib/validation/self-reliance';
import { invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { createResource, listResources } from '@/server/self-reliance/resources';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await listResources(getDb())), {
  permission: { module: 'self-reliance', action: 'read' },
});

export const POST = withAuth(
  async (request, { session }) => {
    const body = resourceSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    return NextResponse.json(await createResource(getDb(), body.data, session.user.id), { status: 201 });
  },
  { permission: { module: 'self-reliance', action: 'create' } },
);
