import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { getDashboard } from '@/server/dashboard/dashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="text-sm text-text-muted">{label}</div>
      <div className="text-2xl font-semibold text-text">{value}</div>
      {sub ? <div className="mt-0.5 text-sm text-text-muted">{sub}</div> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isGlobalAdmin(session)) redirect('/admin');

  const t = await getTranslations('dashboard');
  const tRoles = await getTranslations('roles');
  const locale = await getLocale();
  const data = await getDashboard(getDb());

  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(data.estimatedCost);
  const formatDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const active = data.trips.active;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('users.title')} value={String(data.users.total)} sub={t('users.active', { n: data.users.active })} />
        <Stat label={t('pendingVerify')} value={String(data.users.pending)} />
        <Stat label={t('trips.title')} value={String(data.trips.total)} sub={active ? t('trips.hasActive') : t('trips.none')} />
        <Link href="/admin/temple-trips" className="rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong">
          <div className="text-sm text-text-muted">{t('participantsPending')}</div>
          <div className="text-2xl font-semibold text-text">{String(data.participantsPendingApproval)}</div>
          <div className="mt-0.5 text-sm text-primary">{t('goToApprovals')}</div>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-text">{t('byRole.title')}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {data.users.byRole.map((row) => (
              <li key={row.role} className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{tRoles(row.role as Parameters<typeof tRoles>[0])}</span>
                <span className="font-medium text-text">{String(row.count)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-text">{t('estimatedCost.title')}</h2>
          <p className="mt-1 text-2xl font-semibold text-text">{money}</p>
          <p className="mt-1 text-xs text-text-muted">{t('estimatedCost.note')}</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text">{t('activeTrip.title')}</h2>
        {active ? (
          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:flex-col sm:gap-0.5">
              <dt className="text-text-muted">{t('activeTrip.date')}</dt>
              <dd className="font-medium text-text">{active.dateConfirmed ? formatDate(active.date) : t('activeTrip.dateUnconfirmed', { date: formatDate(active.date) })}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:flex-col sm:gap-0.5">
              <dt className="text-text-muted">{t('activeTrip.deadline')}</dt>
              <dd className="font-medium text-text">{formatDate(active.registrationDeadline)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-sm text-text-muted">{t('trips.none')}</p>
        )}
      </div>
    </section>
  );
}
