import { NextResponse } from 'next/server';
import { startMfaSetup } from '@/server/auth/mfa';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

// Genera el secreto (guardado cifrado, todavía sin activar) y su QR. Exenta del candado: es
// justamente el paso para activar la verificación obligatoria.
export const POST = withAuth(
  async (_request, { session }) => {
    const db = getDb();
    const { unitName } = await getConfig(db);
    return NextResponse.json(await startMfaSetup(db, session, unitName), { headers: { 'Cache-Control': 'no-store' } });
  },
  { mfaExempt: true },
);
