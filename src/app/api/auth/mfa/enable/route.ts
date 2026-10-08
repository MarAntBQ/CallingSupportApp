import { NextResponse } from 'next/server';
import { mfaEnableSchema } from '@/lib/validation/mfa';
import { backgroundMailer } from '@/server/auth/background-mail';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { enableMfa } from '@/server/auth/mfa';
import { getDb } from '@/server/db';
import { privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request, { session }) => {
    const parsed = mfaEnableSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [{ key: privateHash('mfa:user', session.user.id), ...LIMITS.mfaCodePerUser }]);
    const result = await enableMfa(db, session, parsed.data.code, { mailer: backgroundMailer });
    if (result.ok) return NextResponse.json({ recoveryCodes: result.codes }, { headers: { 'Cache-Control': 'no-store' } });
    if (result.error === 'mfa_already_enabled') throw new AuthError(409, 'mfa_already_enabled');
    if (result.error === 'not_found') throw new AuthError(404, 'not_found');
    const code = result.error === 'mfa_not_started' ? 'not_started' : 'incorrect';
    return NextResponse.json({ error: 'invalid_input', fields: ['code'], issues: [{ field: 'code', code }] }, { status: 400 });
  },
  { mfaExempt: true },
);
