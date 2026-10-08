import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPanelSession } from '@/server/auth/panel';
import { listCamps } from '@/server/camps/camps';
import { getDb } from '@/server/db';
import { moduleActionsOf } from '@/server/permissions/service';
import { CampsAdmin } from './camps-admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('camps');
  return { title: t('title') };
}

export default async function CampsPage() {
  const session = await getPanelSession();
  const db = getDb();
  const actions = await moduleActionsOf(db, session.user, 'camps');
  if (!actions.read) redirect('/admin');
  const camps = await listCamps(db);
  return <CampsAdmin initialCamps={camps} canCreate={actions.create} canUpdate={actions.update} />;
}
