import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from '@/i18n/config';

const bodySchema = z.object({ locale: z.enum(LOCALES) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(LOCALE_COOKIE, parsed.data.locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
