import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPanelSession } from '@/server/auth/panel';
import { getDb } from '@/server/db';
import { moduleActionsOf } from '@/server/permissions/service';
import { listWardCouncil } from '@/server/users/users';
import { WardCouncilAdmin } from './ward-council-admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wardCouncil');
  return { title: t('title') };
}

export default async function WardCouncilPage() {
  const session = await getPanelSession();
  const db = getDb();
  const actions = await moduleActionsOf(db, session.user, 'users');
  if (!actions.read) redirect('/admin');
  const groups = await listWardCouncil(db);
  return <WardCouncilAdmin groups={groups} />;
}
