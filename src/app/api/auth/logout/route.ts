import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionFromRequest } from '@/server/auth/session';
import { revokeSession } from '@/server/auth/sessions';
import { getDb } from '@/server/db';

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (session) await revokeSession(getDb(), session.id);
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
