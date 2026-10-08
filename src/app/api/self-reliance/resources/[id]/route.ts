import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resourceUpdateSchema } from '@/lib/validation/self-reliance';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { deleteResource, updateResource } from '@/server/self-reliance/resources';

export const dynamic = 'force-dynamic';

function resourceId(value: string) {
  const id = z.uuid().safeParse(value);
  if (!id.success) throw new AuthError(404, 'not_found');
  return id.data;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = resourceId(params.id);
    const body = resourceUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const resource = await updateResource(getDb(), id, body.data);
    if (!resource) throw new AuthError(404, 'not_found');
    return NextResponse.json(resource);
  },
  { permission: { module: 'self-reliance', action: 'update' } },
);

export const DELETE = withAuth<{ id: string }>(
  async (_request, { params }) => {
    if (!(await deleteResource(getDb(), resourceId(params.id)))) throw new AuthError(404, 'not_found');
    return new NextResponse(null, { status: 204 });
  },
  { permission: { module: 'self-reliance', action: 'delete' } },
);
