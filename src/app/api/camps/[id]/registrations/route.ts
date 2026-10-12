import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { isLocale } from '@/i18n/config';
import { adminRegistrationSchema } from '@/lib/validation/camps';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { accessLinkEmail } from '@/server/camps/emails';
import { linkBaseUrl, parseId } from '@/server/camps/http';
import { adminRegister } from '@/server/camps/participants';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { sendMail } from '@/server/mail/service';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth<{ id: string }>(
  async (request, { params, session }) => {
    const campId = parseId(params.id);
    const body = adminRegistrationSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    const db = getDb();
    const config = await getConfig(db);
    const locale = isLocale(session.user.locale) ? session.user.locale : isLocale(config.defaultLocale) ? config.defaultLocale : 'es';
    const result = await adminRegister(db, campId, body.data, { userId: session.user.id, policyVersion: config.policyVersion, locale });
    if (!result.ok) throw new AuthError(404, 'not_found');
    // Solo a quien tiene correo propio; a los demás el organizador les envía el enlace después.
    const base = linkBaseUrl(request);
    if (base) {
      for (const link of result.links) {
        if (!link.email) continue;
        waitUntil(sendMail('camps-access-link', accessLinkEmail(link.email, locale, result.campName, link.fullName, `${base}/camps/me/${link.token}`), { db, maskRecipient: true }));
      }
    }
    return NextResponse.json({ ok: true, count: result.links.length }, { status: 201 });
  },
  { permission: { module: 'camps', action: 'create' } },
);
