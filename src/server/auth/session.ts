import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { cache } from 'react';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/config';
import { getDb } from '@/server/db';
import { AuthError } from './errors';
import { assertGlobalAdmin, findSession, sessionCookieName } from './sessions';

export function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function getSessionFromRequest(request: Request) {
  return findSession(getDb(), readCookie(request, sessionCookieName()));
}

export async function requireSessionFromRequest(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) throw new AuthError(401, 'unauthenticated');
  return session;
}

export async function requireGlobalAdminFromRequest(request: Request) {
  return assertGlobalAdmin(await requireSessionFromRequest(request));
}

export const getSession = cache(async () => {
  const store = await cookies();
  return findSession(getDb(), store.get(sessionCookieName())?.value);
});

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new AuthError(401, 'unauthenticated');
  return session;
}

export async function requireGlobalAdmin() {
  return assertGlobalAdmin(await requireSession());
}

const secure = () => process.env.NODE_ENV === 'production';

export function setSessionCookie(
  response: NextResponse,
  token: string,
  { expiresAt, persistent }: { expiresAt: Date; persistent: boolean },
) {
  response.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: '/',
    ...(persistent ? { expires: expiresAt } : {}),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName(), '', { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/', maxAge: 0 });
}

export function setLocaleCookie(response: NextResponse, locale: string) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
    httpOnly: true,
    secure: secure(),
  });
}
