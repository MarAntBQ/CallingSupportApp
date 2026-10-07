import 'server-only';
import { getSession } from '@/server/auth/session';
import { currentConfig } from '@/server/config/current';

export async function getUserLocale(): Promise<string | null> {
  return (await getSession())?.user.locale ?? null;
}

export async function getInstallationLocale(): Promise<string | null> {
  return (await currentConfig()).defaultLocale;
}
