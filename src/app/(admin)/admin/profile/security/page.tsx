import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { mfaStatus } from '@/server/auth/mfa';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { SecurityPanel } from './security-panel';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('security');
  return { title: t('title') };
}

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('security');
  const status = await mfaStatus(getDb(), session);

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('intro')}</p>
      </div>
      <SecurityPanel initial={status} />
    </section>
  );
}
