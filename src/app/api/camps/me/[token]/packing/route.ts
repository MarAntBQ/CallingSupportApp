import { NextResponse } from 'next/server';
import { packingToggleSchema } from '@/lib/validation/camps';
import { invalidInputResponse } from '@/server/auth/errors';
import { togglePackingByToken } from '@/server/camps/packing';
import { getDb } from '@/server/db';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = publicRoute<{ token: string }>(
  async (request, { params }) => {
    const body = packingToggleSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await togglePackingByToken(getDb(), params.token, body.data.itemId, body.data.checked);
    if (!result.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  },
  { reason: 'El participante marca su lista de qué llevar desde su enlace personal (token).' },
);
