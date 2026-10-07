import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { getPublicActiveTrip } from '@/server/temple-trips/registrations';
import { PublicRegistration } from './public-registration';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('templeTrips.public');
  return { title: t('title') };
}

export default async function TempleTripPage() {
  const db = getDb();
  const config = await getConfig(db);
  const trip = await getPublicActiveTrip(db, config.timezone);
  return (
    <PublicRegistration
      unitName={config.unitName}
      logoDataUrl={config.logoDataUrl}
      retentionMonths={config.retentionMonths}
      recaptchaSiteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? null}
      trip={trip}
    />
  );
}
