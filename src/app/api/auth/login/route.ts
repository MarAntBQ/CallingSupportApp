import { NextResponse } from 'next/server';
import { isLocale } from '@/i18n/config';
import { loginSchema } from '@/lib/validation/auth';
import { errorResponse } from '@/server/auth/errors';
import { authenticate } from '@/server/auth/login';
import { setLocaleCookie, setSessionCookie } from '@/server/auth/session';
import { createSession, findSession, toMe } from '@/server/auth/sessions';
import { getDb } from '@/server/db';

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  try {
    const db = getDb();
    const { email, password, rememberMe } = parsed.data;
    const user = await authenticate(db, email, password);
    const { token, expiresAt } = await createSession(db, user.id, {
      rememberMe,
      userAgent: request.headers.get('user-agent'),
    });
    const session = await findSession(db, token);
    const response = NextResponse.json(toMe(session!));
    setSessionCookie(response, token, { expiresAt, persistent: rememberMe });
    if (isLocale(user.locale)) setLocaleCookie(response, user.locale);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
