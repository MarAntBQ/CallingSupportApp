import { NextResponse } from 'next/server';
import { reorderSchema } from '@/lib/validation/self-reliance';
import { invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { reorderResources } from '@/server/self-reliance/resources';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request) => {
    const body = reorderSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await reorderResources(getDb(), body.data.ids);
    if (!result.ok) {
      return NextResponse.json({ error: 'invalid_input', fields: ['ids'], issues: [{ field: 'ids', code: 'stale' }] }, { status: 409 });
    }
    return NextResponse.json(result.resources);
  },
  { permission: { module: 'self-reliance', action: 'update' } },
);
