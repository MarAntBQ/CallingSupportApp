import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getDb } from '@/server/db';
import { isSetupNeeded } from '@/server/setup/service';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('setup');
  return { title: t('title') };
}

export default async function SetupPage() {
  if (!(await isSetupNeeded(getDb()))) redirect('/login');

  const t = await getTranslations('setup');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AuthShell title={t('title')} intro={t('intro')}>
      <SetupForm today={today} />
    </AuthShell>
  );
}
