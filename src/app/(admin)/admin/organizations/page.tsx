import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPanelSession } from '@/server/auth/panel';
import { getDb } from '@/server/db';
import { listCallings, listOrganizations } from '@/server/organizations/catalog';
import { getPermissionMatrix } from '@/server/permissions/matrix';
import { moduleActionsOf } from '@/server/permissions/service';
import { Catalog } from './catalog';
import { PermissionsSection } from './permissions-section';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('organizations');
  return { title: t('title') };
}

const hasAny = (actions: Record<string, boolean>) => Object.values(actions).some(Boolean);

export default async function OrganizationsPage() {
  const session = await getPanelSession();
  const db = getDb();
  const [catalog, permissions] = await Promise.all([
    moduleActionsOf(db, session.user, 'callings'),
    moduleActionsOf(db, session.user, 'permissions'),
  ]);
  if (!hasAny(catalog) && !hasAny(permissions)) redirect('/admin');
  const t = await getTranslations('organizations');
  const [organizations, callings, matrix] = await Promise.all([
    hasAny(catalog) ? listOrganizations(db) : [],
    hasAny(catalog) ? listCallings(db) : [],
    permissions.read ? getPermissionMatrix(db) : null,
  ]);

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <p className="text-text-muted">{t('intro')}</p>
      </div>
      {hasAny(catalog) && (
        <Catalog
          initialOrganizations={organizations}
          initialCallings={callings}
          canCreate={catalog.create}
          canUpdate={catalog.update}
        />
      )}
      {matrix && <PermissionsSection initialMatrix={matrix} canUpdate={permissions.update} />}
    </section>
  );
}
