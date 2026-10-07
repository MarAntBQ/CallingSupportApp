import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isLocale, type Locale } from '@/i18n/config';
import { registrationSchema } from '@/lib/validation/registrations';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { adminRegister } from '@/server/temple-trips/registrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function localeFromRequest(request: Request, fallback: Locale): Locale {
  const match = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)csa_locale=([^;]+)/);
  return isLocale(match?.[1]) ? (match![1] as Locale) : fallback;
}

export const POST = withAuth<{ id: string }>(
  async (request, { session, params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const body = registrationSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const db = getDb();
    const config = await getConfig(db);
    const fallback: Locale = isLocale(config.defaultLocale) ? config.defaultLocale : 'es';
    const result = await adminRegister(db, id.data, body.data, {
      ip: null,
      locale: localeFromRequest(request, fallback),
      policyVersion: config.policyVersion,
      createdByUserId: session.user.id,
    });
    if (!result.ok) {
      if (result.status === 404) throw new AuthError(404, 'not_found');
      return NextResponse.json(
        { error: 'invalid_input', fields: [], issues: [{ field: result.resource ?? 'participants', code: result.code }] },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, count: result.count }, { status: 201 });
  },
  { permission: { module: 'temple-trips', action: 'create' } },
);
