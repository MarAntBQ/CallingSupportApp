import { NextResponse } from 'next/server';
import { packingToggleSchema } from '@/lib/validation/camps';
import { invalidInputResponse } from '@/server/auth/errors';
import { togglePackingByToken } from '@/server/camps/packing';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute<{ token: string }>(
  async (request, { params }) => {
    const db = getDb();
    // Endpoint público de escritura (#28): límite por IP antes de tocar la base.
    await consume(db, [{ key: privateHash('camps:packing:ip', clientIp(request)), ...LIMITS.campPackingTogglePerIp }]);
    const body = packingToggleSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const result = await togglePackingByToken(db, params.token, body.data.itemId, body.data.checked);
    if (!result.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  },
  { reason: 'El participante marca su lista de qué llevar desde su enlace personal (token).' },
);
