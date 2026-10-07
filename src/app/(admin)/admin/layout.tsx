import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';
import { LogoutButton } from '@/components/logout-button';
import { UnitBrand } from '@/components/unit-brand';
import { Alert } from '@/components/ui/alert';
import { getSession } from '@/server/auth/session';
import { countActiveAdmins, isGlobalAdmin } from '@/server/auth/sessions';
import { currentConfig } from '@/server/config/current';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

const ROLE_KEYS = ['super_admin', 'leader', 'member', 'friend'] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const t = await getTranslations('admin');
  const tRoles = await getTranslations('roles');
  const admin = isGlobalAdmin(session);
  const missingSecondAdmin = admin && (await countActiveAdmins(getDb())) < 2;
  const missingContact = admin && !(await currentConfig()).contact;
  const roleKey = ROLE_KEYS.find((key) => key === session.user.role.key);
  const roleLabel = roleKey ? tRoles(roleKey) : session.user.role.name;

  const links = [
    { href: '/admin', label: t('nav.home'), ready: true },
    { href: '/admin/profile', label: t('nav.profile'), ready: false },
    ...(admin
      ? [
          { href: '/admin/settings', label: t('nav.settings'), ready: true },
          { href: '/admin/sessions', label: t('nav.sessions'), ready: false },
        ]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <Link
          href="/admin"
          aria-label={t('nav.home')}
          className="flex max-w-full px-5 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <UnitBrand size={36} fallback={<Logo className="h-8 w-auto" />} />
        </Link>
        <nav aria-label={t('navLabel')}>
          <ul className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={link.ready ? undefined : false}
                  className="block rounded-sm px-3 py-2 text-sm whitespace-nowrap text-text hover:bg-surface-muted hover:text-primary-strong"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
          <p className="text-sm text-text">
            <span className="font-semibold">
              {session.user.firstName} {session.user.lastName}
            </span>
            <span className="text-text-muted"> · {roleLabel}</span>
          </p>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <LogoutButton />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-5 md:p-8">
          {missingSecondAdmin && (
            <Alert tone="warning" role="status" title={t('secondAdmin.title')}>
              {t('secondAdmin.body')}
            </Alert>
          )}
          {missingContact && (
            <Alert tone="warning" role="status" title={t('missingContact.title')}>
              <Link href="/admin/settings" className="font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline">
                {t('missingContact.body')}
              </Link>
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
