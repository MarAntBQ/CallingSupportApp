import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPanelSession } from '@/server/auth/panel';
import { getDb } from '@/server/db';
import { moduleActionsOf } from '@/server/permissions/service';
import { listTempleTrips } from '@/server/temple-trips/trips';
import { TempleTripsAdmin } from './trips-admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('templeTrips');
  return { title: t('title') };
}

export default async function TempleTripsPage() {
  const session = await getPanelSession();
  const db = getDb();
  const actions = await moduleActionsOf(db, session.user, 'temple-trips');
  if (!actions.read) redirect('/admin');
  const trips = await listTempleTrips(db);
  return <TempleTripsAdmin initialTrips={trips} canCreate={actions.create} canUpdate={actions.update} canDelete={actions.delete} />;
}
