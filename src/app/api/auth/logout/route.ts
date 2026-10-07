import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionFromRequest } from '@/server/auth/session';
import { revokeSession } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { publicRoute } from '@/server/security/route';

export const POST = publicRoute(
  async (request) => {
    const session = await getSessionFromRequest(request);
    if (session) await revokeSession(getDb(), session.id);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  },
  { reason: 'cerrar sesión tiene que funcionar aunque la sesión ya haya vencido; solo revoca la propia' },
);
