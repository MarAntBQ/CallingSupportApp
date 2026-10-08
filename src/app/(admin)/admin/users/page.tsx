import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { asc, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { callings, organizations, roles } from '@/server/db/schema';
import { moduleActionsOf } from '@/server/permissions/service';
import { listUsers } from '@/server/users/users';
import { UsersAdmin } from './users-admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('users');
  return { title: t('title') };
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const db = getDb();
  const actions = await moduleActionsOf(db, session.user, 'users');
  if (!actions.read) redirect('/admin');

  const [initialUsers, roleRows, orgRows, callingRows] = await Promise.all([
    listUsers(db),
    db.select({ id: roles.id, key: roles.key, name: roles.name, level: roles.level }).from(roles).orderBy(desc(roles.level)),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.active, true)).orderBy(asc(organizations.name)),
    db.select({ id: callings.id, name: callings.name, organizationId: callings.organizationId }).from(callings).where(eq(callings.active, true)).orderBy(asc(callings.name)),
  ]);

  const orgs = orgRows.map((org) => ({ ...org, callings: callingRows.filter((calling) => calling.organizationId === org.id) }));

  return <UsersAdmin initialUsers={initialUsers} roles={roleRows} orgs={orgs} canCreate={actions.create} canUpdate={actions.update} />;
}
