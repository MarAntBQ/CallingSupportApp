import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, LOCALE_COOKIE, pickLocale } from './config';
import { getInstallationLocale, getUserLocale } from './preferences';

export async function resolveLocale() {
  const user = await getUserLocale();
  if (isLocale(user)) return user;
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return pickLocale([await getInstallationLocale()]);
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
