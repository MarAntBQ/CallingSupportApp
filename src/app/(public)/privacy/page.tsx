import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Alert } from '@/components/ui/alert';
import { isLocale } from '@/i18n/config';
import {
  CHURCH_URL,
  controllerConfigured,
  ONLINE_RESOURCES_HANDBOOK_URL,
  POLICY_SECTIONS,
  recaptchaEnabled,
} from '@/lib/privacy-policy';
import { getSession } from '@/server/auth/session';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { currentConfig } from '@/server/config/current';

export const dynamic = 'force-dynamic';

const LINK = 'font-medium text-primary underline underline-offset-4 hover:text-primary-strong';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('privacyPolicy');
  return { title: t('title') };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('privacyPolicy');
  const activeLocale = await getLocale();
  const locale = isLocale(activeLocale) ? activeLocale : 'es';
  const config = await currentConfig();
  const session = await getSession();
  const { controller } = config;
  const configured = controllerConfigured(controller);
  const mail = (chunks: ReactNode) =>
    controller.email ? (
      <a href={`mailto:${controller.email}`} className={LINK}>
        {chunks}
      </a>
    ) : (
      chunks
    );
  const values = {
    name: controller.name ?? t('sections.s1.notSet'),
    email: controller.email ?? t('sections.s1.notSet'),
    city: controller.city ?? t('sections.s1.notSet'),
    phone: controller.phone ?? t('sections.s1.notSet'),
    address: controller.address ?? t('sections.s1.notSet'),
  };

  function body(section: (typeof POLICY_SECTIONS)[number]) {
    switch (section) {
      case 's1':
        return (
          <>
            <p>{t.rich('sections.s1.body', { ...values, b: (chunks) => <strong>{chunks}</strong>, mail })}</p>
            {controller.website && (
              <p>
                {t.rich('sections.s1.website', {
                  website: controller.website,
                  web: (chunks) => (
                    <a href={controller.website!} rel="noopener noreferrer" target="_blank" className={LINK}>
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            )}
          </>
        );
      case 's2':
        return (
          <>
            <p>{t('sections.s2.body')}</p>
            <p>{t('sections.s2.notices')}</p>
          </>
        );
      case 's5':
        return <p>{t('sections.s5.body', { months: config.retentionMonths })}</p>;
      case 's10':
        return (
          <p>
            {t('sections.s10.body')} {recaptchaEnabled() ? t('sections.s10.google') : ''} {t('sections.s10.none')}
          </p>
        );
      case 's13':
      case 's14':
        return <p>{t.rich(`sections.${section}.body`, { email: values.email, mail })}</p>;
      default:
        return <p>{t(`sections.${section}.body`)}</p>;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex justify-end">
          <LocaleSwitcher />
        </div>
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <p className="text-text-muted" data-testid="policy-subtitle">
          {config.unitName
            ? t('subtitle', { unitName: config.unitName, version: config.policyVersion })
            : t('subtitleNoUnit', { version: config.policyVersion })}
        </p>
        <p className="text-sm text-text-muted">
          {t.rich('notOfficial', {
            church: (chunks) => (
              <a href={CHURCH_URL[locale]} rel="noopener noreferrer" target="_blank" className={LINK}>
                {chunks}
              </a>
            ),
            handbook: (chunks) => (
              <a href={ONLINE_RESOURCES_HANDBOOK_URL[locale]} rel="noopener noreferrer" target="_blank" className={LINK}>
                {chunks}
              </a>
            ),
          })}
        </p>
        {locale !== 'es' && <p className="text-sm text-text-muted italic">{t('discrepancy')}</p>}
      </header>

      {!configured && (
        <Alert tone="warning" role="status" title={t('missingController')}>
          {session && isGlobalAdmin(session) && (
            <Link href="/admin/settings" className={LINK}>
              {t('missingControllerAdmin')}
            </Link>
          )}
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        {POLICY_SECTIONS.map((section) => (
          <section key={section} aria-labelledby={`policy-${section}`} className="flex flex-col gap-2 text-base text-text">
            <h2 id={`policy-${section}`} className="text-lg font-semibold text-text">
              {t(`sections.${section}.title`)}
            </h2>
            {body(section)}
          </section>
        ))}
      </div>
    </div>
  );
}
