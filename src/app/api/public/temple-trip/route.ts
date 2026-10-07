import { NextResponse } from 'next/server';
import { isLocale, type Locale } from '@/i18n/config';
import { registrationSchema } from '@/lib/validation/registrations';
import { invalidInputResponse } from '@/server/auth/errors';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { notifyModuleEvent } from '@/server/notifications/service';
import { clientIp } from '@/server/security/http';
import { verifyRecaptcha } from '@/server/security/recaptcha';
import { publicRoute } from '@/server/security/route';
import { registrationNotice } from '@/server/temple-trips/registration-notice';
import { createRegistration, getPublicActiveTrip } from '@/server/temple-trips/registrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function localeFromRequest(request: Request, fallback: Locale): Locale {
  const match = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)csa_locale=([^;]+)/);
  return isLocale(match?.[1]) ? (match![1] as Locale) : fallback;
}

export const GET = publicRoute(
  async () => {
    const db = getDb();
    const config = await getConfig(db);
    const trip = await getPublicActiveTrip(db, config.timezone);
    if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(trip);
  },
  { reason: 'viaje activo para la página pública de inscripción; sin datos de personas' },
);

export const POST = publicRoute(
  async (request) => {
    const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    if (!(await verifyRecaptcha(parsed.data.recaptchaToken))) {
      return NextResponse.json(
        { error: 'invalid_input', fields: ['recaptchaToken'], issues: [{ field: 'recaptchaToken', code: 'recaptcha_failed' }] },
        { status: 400 },
      );
    }
    const db = getDb();
    const config = await getConfig(db);
    const fallback: Locale = isLocale(config.defaultLocale) ? config.defaultLocale : 'es';
    const locale = localeFromRequest(request, fallback);
    const result = await createRegistration(
      db,
      parsed.data,
      { ip: clientIp(request), locale, policyVersion: config.policyVersion },
      config.timezone,
    );
    if (!result.ok) {
      if (result.status === 404) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json(
        { error: 'invalid_input', fields: [], issues: [{ field: result.resource ?? 'participants', code: result.code }] },
        { status: 400 },
      );
    }
    const panelUrl = `${new URL(request.url).origin}/admin/temple-trips`;
    await notifyModuleEvent('temple-trips', (noticeLocale) => registrationNotice(noticeLocale, result.count, panelUrl), { db });
    return NextResponse.json({ ok: true, count: result.count }, { status: 201 });
  },
  { reason: 'inscripción pública al viaje al templo; recoge datos de personas con consentimiento' },
);
