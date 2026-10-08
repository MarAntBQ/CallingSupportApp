import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { isLocale } from '@/i18n/config';
import { AuthError } from '@/server/auth/errors';
import { accessLinkEmail } from '@/server/camps/emails';
import { linkBaseUrl, parseId } from '@/server/camps/http';
import { issueNewLink } from '@/server/camps/participants';
import { getDb } from '@/server/db';
import { sendMail } from '@/server/mail/service';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Envía un enlace personal nuevo e invalida el anterior (solo se guarda el hash: no hay forma de
// reenviar el mismo). La respuesta nunca trae el token.
export const POST = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = parseId(params.id);
    const base = linkBaseUrl(request);
    if (!base) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    const db = getDb();
    const result = await issueNewLink(db, id);
    if (!result.ok && result.status === 404) throw new AuthError(404, 'not_found');
    if (!result.ok) return NextResponse.json({ error: 'invalid_input', fields: ['email'], issues: [{ field: 'email', code: result.code }] }, { status: 400 });
    const locale = isLocale(result.locale) ? result.locale : 'es';
    waitUntil(sendMail('camps-access-link', accessLinkEmail(result.email, locale, result.campName, result.fullName, `${base}/camps/me/${result.token}`), { db, maskRecipient: true }));
    return NextResponse.json({ ok: true });
  },
  { permission: { module: 'camps', action: 'update' } },
);
