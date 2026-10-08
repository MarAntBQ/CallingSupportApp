import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Alert } from '@/components/ui/alert';
import { isLocale } from '@/i18n/config';
import { formatMoney } from '@/lib/format';
import { getPersonalLink } from '@/server/camps/registrations';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('camps.me');
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

function formatDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function PersonalLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('camps.me');
  const locale = await getLocale();
  const view = await getPersonalLink(getDb(), token);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      {view ? (
        <>
          <header className="flex flex-col gap-1">
            <p className="text-sm text-text-muted">{view.camp.name}</p>
            <h1 className="text-2xl font-semibold text-text" data-testid="me-name">
              {view.participant.fullName}
            </h1>
            <p className="text-sm text-text-muted">
              {t('dates', { start: formatDate(view.camp.startDate, locale), end: formatDate(view.camp.endDate, locale) })} · {view.camp.location}
            </p>
          </header>
          <Alert tone={view.participant.approved ? 'success' : 'info'} role="status" title={view.participant.approved ? t('approved') : t('pending')}>
            {view.participant.approved ? t('approvedBody') : t('pendingBody')}
          </Alert>
          {view.contribution && (
            <section className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4" data-testid="me-contribution">
              <h2 className="text-lg font-semibold text-text">{t('contribution.title')}</h2>
              <p className="text-base font-medium text-text">
                {t('contribution.amount', { amount: formatMoney(Number(view.contribution.suggested), isLocale(locale) ? locale : 'es') })}
              </p>
              <p className="text-sm text-text-muted">{t('contribution.note')}</p>
              {view.contribution.categoryName && <p className="text-sm font-medium text-text">{t('contribution.category', { category: view.contribution.categoryName })}</p>}
              {view.contribution.instructions && <p className="text-sm whitespace-pre-line text-text-muted">{view.contribution.instructions}</p>}
            </section>
          )}
        </>
      ) : (
        <Alert tone="warning" role="status" title={t('invalid')} />
      )}
      <div className="flex justify-center border-t border-border pt-4">
        <LocaleSwitcher />
      </div>
    </div>
  );
}
