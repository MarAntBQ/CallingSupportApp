import { NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validation/registration';
import { backgroundMailer } from '@/server/auth/background-mail';
import { invalidInputResponse } from '@/server/auth/errors';
import { forgotPassword } from '@/server/auth/registration';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute(
  async (request) => {
    const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [
      { key: privateHash('forgot:email', parsed.data.email), ...LIMITS.forgotPerEmail },
      { key: privateHash('forgot:ip', clientIp(request)), ...LIMITS.forgotPerIp },
    ]);
    await forgotPassword(db, parsed.data, { mailer: backgroundMailer });
    return NextResponse.json({ sent: true });
  },
  { reason: 'pedir un código para restablecer la contraseña: no hay sesión; responde igual exista o no el correo' },
);
