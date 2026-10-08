import { NextResponse } from 'next/server';
import { getPersonalLink } from '@/server/camps/registrations';
import { getDb } from '@/server/db';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = publicRoute<{ token: string }>(
  async (_request, { params }) => {
    const view = await getPersonalLink(getDb(), params.token);
    if (!view) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(view);
  },
  { reason: 'enlace personal del participante; el token de 32 bytes es la credencial' },
);
