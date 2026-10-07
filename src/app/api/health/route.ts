import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = publicRoute(
  async () => {
    try {
      await getDb().execute(sql`select 1`);
      return NextResponse.json({ ok: true, db: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ ok: false, db: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  },
  { reason: 'monitoreo de disponibilidad: no devuelve datos' },
);
