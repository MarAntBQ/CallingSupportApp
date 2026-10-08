import { NextResponse } from 'next/server';
import { mfaDisableSchema } from '@/lib/validation/mfa';
import { backgroundMailer } from '@/server/auth/background-mail';
import { invalidInputResponse } from '@/server/auth/errors';
import { disableMfa } from '@/server/auth/mfa';
import { getDb } from '@/server/db';
import { privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { session }) => {
  const parsed = mfaDisableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse(parsed.error);
  const db = getDb();
  await consume(db, [{ key: privateHash('mfa:user', session.user.id), ...LIMITS.mfaCodePerUser }]);
  const result = await disableMfa(db, session, parsed.data, { mailer: backgroundMailer });
  if (result.ok) return new NextResponse(null, { status: 204 });
  const field = result.error === 'invalid_password' ? 'password' : 'code';
  return NextResponse.json({ error: 'invalid_input', fields: [field], issues: [{ field, code: 'incorrect' }] }, { status: 400 });
});
