import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { LogoutButton } from '@/components/logout-button';
import { Alert } from '@/components/ui/alert';
import { getSession } from '@/server/auth/session';
import { countActiveAdmins, isGlobalAdmin } from '@/server/auth/sessions';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

const ROLE_KEYS = ['super_admin', 'leader', 'member', 'friend'] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const t = await getTranslations('admin');
  const tRoles = await getTranslations('roles');
  const tCommon = await getTranslations('common');
  const admin = isGlobalAdmin(session);
  const missingSecondAdmin = admin && (await countActiveAdmins(getDb())) < 2;
  const roleKey = ROLE_KEYS.find((key) => key === session.user.role.key);
  const roleLabel = roleKey ? tRoles(roleKey) : session.user.role.name;

  const links = [
    { href: '/admin', label: t('nav.home') },
    { href: '/admin/profile', label: t('nav.profile') },
    ...(admin
      ? [
          { href: '/admin/settings', label: t('nav.settings') },
          { href: '/admin/sessions', label: t('nav.sessions') },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <p className="px-5 py-4 text-lg font-semibold text-primary">{tCommon('appName')}</p>
        <nav aria-label={t('navLabel')}>
          <ul className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
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
          {children}
        </main>
      </div>
    </div>
  );
}
