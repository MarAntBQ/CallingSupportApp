import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { timeZoneOptions } from '@/lib/validation/config';
import { getMfaPolicy } from '@/server/auth/mfa';
import { getPanelSession } from '@/server/auth/panel';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { MfaPolicyCard } from './mfa-policy-card';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const session = await getPanelSession();
  if (!isGlobalAdmin(session)) redirect('/admin');
  const t = await getTranslations('settings');
  const { requireMfaForLeaders } = await getMfaPolicy(getDb());

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <p className="text-text-muted">{t('intro')}</p>
      </div>
      <SettingsForm timeZones={timeZoneOptions()} currentEmail={session.user.email} />
      <MfaPolicyCard initial={requireMfaForLeaders} />
    </section>
  );
}
