import { NextResponse } from 'next/server';
import { setupSchema } from '@/lib/validation/auth';
import { rateLimited } from '@/server/auth/errors';
import { setSessionCookie } from '@/server/auth/session';
import { createSession, findSession, toMe } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { hit, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';
import { isSetupNeeded, performSetup } from '@/server/setup/service';

export const dynamic = 'force-dynamic';

const REASON = 'asistente del primer administrador: solo funciona mientras la base no tiene usuarios';

export const GET = publicRoute(async () => NextResponse.json({ needed: await isSetupNeeded(getDb()) }), {
  reason: REASON,
});

export const POST = publicRoute(
  async (request) => {
    const db = getDb();
    const attempt = await hit(db, { key: privateHash('setup:ip', clientIp(request)), ...LIMITS.setupPerIp });
    if (attempt.count > LIMITS.setupPerIp.max) {
      throw rateLimited((attempt.resetAt.getTime() - Date.now()) / 1000);
    }

    if (!(await isSetupNeeded(db))) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const parsed = setupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')))].filter(Boolean);
      return NextResponse.json({ error: 'invalid_input', fields }, { status: 400 });
    }

    const { userId } = await performSetup(db, parsed.data);
    const { token, expiresAt } = await createSession(db, userId, { userAgent: request.headers.get('user-agent') });
    const session = await findSession(db, token);
    const response = NextResponse.json(toMe(session!), { status: 201 });
    setSessionCookie(response, token, { expiresAt, persistent: false });
    return response;
  },
  { reason: REASON },
);
