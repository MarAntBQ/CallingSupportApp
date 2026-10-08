import { NextResponse } from 'next/server';
import { mfaRecoveryCodesSchema } from '@/lib/validation/mfa';
import { invalidInputResponse } from '@/server/auth/errors';
import { regenerateRecoveryCodes } from '@/server/auth/mfa';
import { getDb } from '@/server/db';
import { privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

// Genera 10 códigos de recuperación nuevos e invalida los anteriores. Se muestran una sola vez.
export const POST = withAuth(async (request, { session }) => {
  const parsed = mfaRecoveryCodesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse(parsed.error);
  const db = getDb();
  await consume(db, [{ key: privateHash('mfa:user', session.user.id), ...LIMITS.mfaCodePerUser }]);
  const result = await regenerateRecoveryCodes(db, session, parsed.data.code);
  if (result.ok) return NextResponse.json({ recoveryCodes: result.codes }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ error: 'invalid_input', fields: ['code'], issues: [{ field: 'code', code: 'incorrect' }] }, { status: 400 });
});
