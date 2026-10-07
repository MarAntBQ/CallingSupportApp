import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { getSessionFromRequest, readCookie, setLocaleCookie } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { users } from '@/server/db/schema';

const bodySchema = z.object({ locale: z.enum(LOCALES) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 });
  }

  if (readCookie(request, SESSION_COOKIE)) {
    const session = await getSessionFromRequest(request);
    if (session) {
      await getDb().update(users).set({ locale: parsed.data.locale }).where(eq(users.id, session.user.id));
    }
  }

  const response = new NextResponse(null, { status: 204 });
  setLocaleCookie(response, parsed.data.locale);
  return response;
}
