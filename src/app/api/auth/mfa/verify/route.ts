import { NextResponse } from 'next/server';
import { isLocale } from '@/i18n/config';
import { mfaVerifySchema } from '@/lib/validation/mfa';
import { backgroundMailer } from '@/server/auth/background-mail';
import { AuthError, invalidInputResponse, rateLimited } from '@/server/auth/errors';
import { verifyMfaChallenge } from '@/server/auth/mfa';
import { getSessionFromRequest, setLocaleCookie, setSessionCookie } from '@/server/auth/session';
import { createSession, findSession, revokeSession } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { meOf } from '@/server/permissions/service';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const POST = publicRoute(
  async (request) => {
    const parsed = mfaVerifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [{ key: privateHash('mfa:ip', clientIp(request)), ...LIMITS.mfaVerifyPerIp }]);
    const result = await verifyMfaChallenge(db, parsed.data, { mailer: backgroundMailer });
    if (!result.ok) {
      if (result.error === 'too_many_attempts') throw rateLimited(1);
      if (result.error === 'challenge_expired') throw new AuthError(400, 'challenge_expired');
      const field = parsed.data.recoveryCode ? 'recoveryCode' : 'code';
      return NextResponse.json({ error: 'invalid_input', fields: [field], issues: [{ field, code: 'incorrect' }] }, { status: 400 });
    }

    const previous = await getSessionFromRequest(request);
    if (previous) await revokeSession(db, previous.id);
    const { token, expiresAt } = await createSession(db, result.userId, {
      rememberMe: result.rememberMe,
      userAgent: request.headers.get('user-agent'),
    });
    const session = await findSession(db, token);
    const response = NextResponse.json(await meOf(db, session!));
    setSessionCookie(response, token, { expiresAt, persistent: result.rememberMe });
    if (isLocale(result.locale)) setLocaleCookie(response, result.locale);
    return response;
  },
  { reason: 'segundo paso del inicio de sesión: todavía no hay sesión; protegido por el reto de 5 minutos, 5 intentos y límite por IP' },
);
