import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPanelSession } from '@/server/auth/panel';
import { getDb } from '@/server/db';
import { moduleActionsOf } from '@/server/permissions/service';
import { listResources } from '@/server/self-reliance/resources';
import { ResourcesAdmin } from './resources-admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('selfReliance');
  return { title: t('title') };
}

export default async function SelfReliancePage() {
  const session = await getPanelSession();
  const db = getDb();
  const actions = await moduleActionsOf(db, session.user, 'self-reliance');
  if (!actions.read) redirect('/admin');
  const resources = await listResources(db);
  return <ResourcesAdmin initialResources={resources} canCreate={actions.create} canUpdate={actions.update} canDelete={actions.delete} />;
}
