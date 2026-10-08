import { NextResponse } from 'next/server';
import { getPublicCamp } from '@/server/camps/registrations';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = publicRoute<{ slug: string }>(
  async (_request, { params }) => {
    const db = getDb();
    const config = await getConfig(db);
    const camp = await getPublicCamp(db, params.slug, config.timezone);
    if (!camp) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(camp);
  },
  { reason: 'datos públicos del campamento para su página de inscripción; sin datos de personas' },
);
