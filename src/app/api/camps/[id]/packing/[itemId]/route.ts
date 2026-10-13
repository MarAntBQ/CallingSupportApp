import { NextResponse } from 'next/server';
import { AuthError } from '@/server/auth/errors';
import { parseId } from '@/server/camps/http';
import { deletePackingItem } from '@/server/camps/packing';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

type Params = { id: string; itemId: string };

export const DELETE = withAuth<Params>(
  async (_request, { params }) => {
    const ok = await deletePackingItem(getDb(), parseId(params.id), parseId(params.itemId));
    if (!ok) throw new AuthError(404, 'not_found');
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'camps', action: 'update' } },
);
