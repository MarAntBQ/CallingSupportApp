import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, pickLocale } from './config';
import { getInstallationLocale, getUserLocale } from './preferences';

export async function resolveLocale() {
  const cookieStore = await cookies();
  return pickLocale([
    await getUserLocale(),
    cookieStore.get(LOCALE_COOKIE)?.value,
    await getInstallationLocale(),
  ]);
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
