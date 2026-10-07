import { NextResponse } from 'next/server';
import { verifyResetOtpSchema } from '@/lib/validation/registration';
import { invalidInputResponse } from '@/server/auth/errors';
import { verifyResetOtp } from '@/server/auth/registration';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute(
  async (request) => {
    const parsed = verifyResetOtpSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [
      { key: privateHash('verify-reset:email', parsed.data.email), ...LIMITS.codePerEmail },
      { key: privateHash('verify-reset:ip', clientIp(request)), ...LIMITS.codePerIp },
    ]);
    const result = await verifyResetOtp(db, parsed.data);
    if (result.ok) return NextResponse.json({ token: result.token });
    const remaining = result.reason === 'wrong_code' ? { remaining: result.remaining } : {};
    return NextResponse.json(
      { error: 'invalid_input', fields: ['code'], issues: [{ field: 'code', code: result.reason }], ...remaining },
      { status: 400 },
    );
  },
  { reason: 'verificar el código para restablecer la contraseña: no hay sesión; con límite por correo e IP' },
);
