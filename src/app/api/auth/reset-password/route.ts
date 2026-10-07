import { NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/lib/validation/registration';
import { backgroundMailer } from '@/server/auth/background-mail';
import { invalidInputResponse } from '@/server/auth/errors';
import { resetPassword } from '@/server/auth/registration';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute(
  async (request) => {
    const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [{ key: privateHash('reset:ip', clientIp(request)), ...LIMITS.codePerIp }]);
    const result = await resetPassword(db, parsed.data, { mailer: backgroundMailer });
    if (result.ok) return NextResponse.json({ reset: true });
    return NextResponse.json(
      { error: 'invalid_input', fields: ['token'], issues: [{ field: 'token', code: 'reset_expired' }] },
      { status: 400 },
    );
  },
  { reason: 'elegir una contraseña nueva con el token del código verificado: no hay sesión; con límite por IP' },
);
