import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getPublicCamp } from '@/server/camps/registrations';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { CampRegistration } from './camp-registration';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('camps.public');
  return { title: t('title') };
}

export default async function CampPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const config = await getConfig(db);
  const camp = await getPublicCamp(db, slug, config.timezone);
  if (!camp) notFound();
  return (
    <CampRegistration
      camp={camp}
      unitName={config.unitName}
      logoDataUrl={config.logoDataUrl}
      retentionMonths={config.retentionMonths}
      recaptchaSiteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? null}
    />
  );
}
