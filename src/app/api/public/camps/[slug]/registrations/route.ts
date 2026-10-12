import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { isLocale, type Locale } from '@/i18n/config';
import { campRegistrationSchema } from '@/lib/validation/camps';
import { invalidInputResponse } from '@/server/auth/errors';
import { accessLinkEmail, campRegistrationNotice } from '@/server/camps/emails';
import { linkBaseUrl } from '@/server/camps/http';
import { createPublicRegistration } from '@/server/camps/registrations';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { sendMail } from '@/server/mail/service';
import { notifyModuleEvent } from '@/server/notifications/service';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { verifyRecaptcha } from '@/server/security/recaptcha';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function localeFromRequest(request: Request, fallback: Locale): Locale {
  const match = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)csa_locale=([^;]+)/);
  return isLocale(match?.[1]) ? (match![1] as Locale) : fallback;
}

export const POST = publicRoute<{ slug: string }>(
  async (request, { params }) => {
    const db = getDb();
    // Límite por IP (#28) para que nadie inunde el formulario con inscripciones automáticas.
    await consume(db, [{ key: privateHash('camps:ip', clientIp(request)), ...LIMITS.campRegistrationPerIp }]);
    const parsed = campRegistrationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    if (!(await verifyRecaptcha(parsed.data.recaptchaToken))) {
      return NextResponse.json(
        { error: 'invalid_input', fields: ['recaptchaToken'], issues: [{ field: 'recaptchaToken', code: 'recaptcha_failed' }] },
        { status: 400 },
      );
    }
    const config = await getConfig(db);
    const locale = localeFromRequest(request, isLocale(config.defaultLocale) ? config.defaultLocale : 'es');
    const result = await createPublicRegistration(
      db,
      params.slug,
      parsed.data,
      { ip: clientIp(request), locale, policyVersion: config.policyVersion },
      config.timezone,
    );
    if (!result.ok) {
      if (result.status === 404) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ error: 'invalid_input', fields: [], issues: [{ field: 'camp', code: result.code }] }, { status: 400 });
    }

    // Los correos y el aviso salen en segundo plano: si el SMTP falla, la inscripción ya quedó
    // guardada y el error queda en el registro de correos, sin datos en la respuesta.
    const base = linkBaseUrl(request);
    if (base) {
      for (const link of result.links) {
        const mail = accessLinkEmail(parsed.data.guardian.email, locale, result.campName, link.fullName, `${base}/camps/me/${link.token}`);
        waitUntil(sendMail('camps-access-link', mail, { db, maskRecipient: true }));
      }
      waitUntil(
        notifyModuleEvent('camps', (noticeLocale) => campRegistrationNotice(noticeLocale, result.campName, result.links.length, `${base}/admin/camps`), { db }),
      );
    } else {
      // Sin URL configurada no se arma un enlace con un host dudoso: la inscripción queda guardada
      // y el organizador puede reenviar el enlace desde el panel. Solo números en el log.
      console.error(JSON.stringify({ event: 'camps_link_base_missing', participants: result.links.length }));
    }
    return NextResponse.json({ ok: true, count: result.links.length }, { status: 201 });
  },
  { reason: 'inscripción pública al campamento; el padre, madre o tutor da su consentimiento' },
);
