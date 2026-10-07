import { NextResponse } from 'next/server';
import { verifyOtpSchema } from '@/lib/validation/registration';
import { backgroundMailer } from '@/server/auth/background-mail';
import { invalidInputResponse } from '@/server/auth/errors';
import { verifyOtp } from '@/server/auth/registration';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute(
  async (request) => {
    const parsed = verifyOtpSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [
      { key: privateHash('verify-otp:email', parsed.data.email), ...LIMITS.codePerEmail },
      { key: privateHash('verify-otp:ip', clientIp(request)), ...LIMITS.codePerIp },
    ]);
    const result = await verifyOtp(db, parsed.data, { mailer: backgroundMailer });
    if (result.ok) return NextResponse.json({ verified: true });
    if (result.reason === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const remaining = result.reason === 'wrong_code' ? { remaining: result.remaining } : {};
    return NextResponse.json(
      { error: 'invalid_input', fields: ['code'], issues: [{ field: 'code', code: result.reason }], ...remaining },
      { status: 400 },
    );
  },
  { reason: 'activar una cuenta nueva con su código: todavía no hay sesión; con límite por correo e IP' },
);
