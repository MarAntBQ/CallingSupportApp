import { NextResponse } from 'next/server';
import { isLocale } from '@/i18n/config';
import { loginSchema } from '@/lib/validation/auth';
import { authenticate } from '@/server/auth/login';
import { getSessionFromRequest, setLocaleCookie, setSessionCookie } from '@/server/auth/session';
import { createLoginSession, findSession, revokeSession, toMe } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { clear, consume, LIMITS, refund } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const POST = publicRoute(
  async (request) => {
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const db = getDb();
    const { email, password, rememberMe } = parsed.data;
    const emailKey = { key: privateHash('login:email', email), ...LIMITS.loginPerEmail };
    const ipKey = { key: privateHash('login:ip', clientIp(request)), ...LIMITS.loginPerIp };
    await consume(db, [emailKey, ipKey]);
    const user = await authenticate(db, email, password);
    await clear(db, emailKey.key);
    await refund(db, ipKey.key);

    const previous = await getSessionFromRequest(request);
    if (previous) await revokeSession(db, previous.id);

    const { token, expiresAt } = await createLoginSession(db, user.id, user.passwordHash, {
      rememberMe,
      userAgent: request.headers.get('user-agent'),
    });
    const session = await findSession(db, token);
    const response = NextResponse.json(toMe(session!));
    setSessionCookie(response, token, { expiresAt, persistent: rememberMe });
    if (isLocale(user.locale)) setLocaleCookie(response, user.locale);
    return response;
  },
  { reason: 'iniciar sesión: todavía no hay sesión; con límite de intentos por correo e IP' },
);
