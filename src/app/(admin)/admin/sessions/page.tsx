import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPanelSession } from '@/server/auth/panel';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { currentConfig } from '@/server/config/current';
import { SessionsTable } from './sessions-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sessions');
  return { title: t('title') };
}

export default async function SessionsPage() {
  const session = await getPanelSession();
  if (!isGlobalAdmin(session)) redirect('/admin');
  const t = await getTranslations('sessions');
  const config = await currentConfig();

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <p className="text-text-muted">{t('intro')}</p>
      </div>
      <SessionsTable currentSessionId={session.id} timeZone={config.timezone} />
    </section>
  );
}
