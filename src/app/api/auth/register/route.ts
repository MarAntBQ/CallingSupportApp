import { NextResponse } from 'next/server';
import { registerSchema } from '@/lib/validation/registration';
import { backgroundMailer } from '@/server/auth/background-mail';
import { invalidInputResponse } from '@/server/auth/errors';
import { register } from '@/server/auth/registration';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute(
  async (request) => {
    const db = getDb();
    await consume(db, [{ key: privateHash('register:ip', clientIp(request)), ...LIMITS.registerPerIp }]);
    const parsed = registerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const result = await register(db, parsed.data, { mailer: backgroundMailer });
    if (result.ok) return NextResponse.json({ email: parsed.data.email }, { status: 201 });
    if (result.reason === 'registration_closed') return NextResponse.json({ error: 'registration_closed' }, { status: 403 });
    return NextResponse.json({ error: 'invalid_input', fields: ['email'], issues: [{ field: 'email', code: 'email_taken' }] }, { status: 400 });
  },
  { reason: 'registro de una cuenta nueva: todavía no hay sesión; solo si la instalación lo permite, con límite por IP' },
);
