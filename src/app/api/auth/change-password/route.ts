import { NextResponse } from 'next/server';
import { changePasswordSchema } from '@/lib/validation/profile';
import { invalidInputResponse } from '@/server/auth/errors';
import { changePassword } from '@/server/auth/profile';
import { getDb } from '@/server/db';
import { privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { session }) => {
  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse(parsed.error);
  const db = getDb();
  await consume(db, [{ key: privateHash('password:user', session.user.id), ...LIMITS.changePasswordPerUser }]);
  const result = await changePassword(db, session, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'invalid_input', fields: ['currentPassword'], issues: [{ field: 'currentPassword', code: 'incorrect' }] },
      { status: 400 },
    );
  }
  return new NextResponse(null, { status: 204 });
});
