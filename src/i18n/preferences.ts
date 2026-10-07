import 'server-only';
import { getSession } from '@/server/auth/session';

export async function getUserLocale(): Promise<string | null> {
  return (await getSession())?.user.locale ?? null;
}

export async function getInstallationLocale(): Promise<string | null> {
  return null;
}
