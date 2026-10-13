import { NextResponse } from 'next/server';
import { packingItemSchema } from '@/lib/validation/camps';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { parseId } from '@/server/camps/http';
import { createPackingItem, listPackingItems } from '@/server/camps/packing';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const items = await listPackingItems(getDb(), parseId(params.id));
    if (!items) throw new AuthError(404, 'not_found');
    return NextResponse.json(items);
  },
  { permission: { module: 'camps', action: 'read' } },
);

export const POST = withAuth<{ id: string }>(
  async (request, { params }) => {
    const body = packingItemSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const item = await createPackingItem(getDb(), parseId(params.id), body.data);
    if (!item) throw new AuthError(404, 'not_found');
    return NextResponse.json(item, { status: 201 });
  },
  { permission: { module: 'camps', action: 'update' } },
);
