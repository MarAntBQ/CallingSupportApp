import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { isLocale } from '@/i18n/config';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { listPublicResources } from '@/server/self-reliance/resources';
import { SelfReliancePortal } from './portal';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('selfReliance.portal');
  return { title: t('title') };
}

export default async function SelfReliancePortalPage() {
  const db = getDb();
  const activeLocale = await getLocale();
  const locale = isLocale(activeLocale) ? activeLocale : 'es';
  const [config, resources] = await Promise.all([getConfig(db), listPublicResources(db, { locale })]);
  return <SelfReliancePortal unitName={config.unitName} logoDataUrl={config.logoDataUrl} locale={locale} resources={resources} />;
}
