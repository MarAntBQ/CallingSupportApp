'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useConfig } from '@/lib/config/use-config';
import { PROJECT_REPOSITORY_URL } from '@/lib/privacy-policy';

const LINK = 'font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline';

export function SiteFooter() {
  const t = useTranslations('common');
  const contact = useConfig().data?.contact;

  return (
    <footer className="border-t border-border bg-surface px-5 py-4 text-center text-sm text-text-muted">
      <div className="mx-auto flex max-w-3xl flex-col gap-1">
        {contact && (
          <p>
            {t('contact')}: <span className="break-words text-text">{contact}</span>
          </p>
        )}
        <p>{t('notOfficial')}</p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/privacy" className={LINK}>
            {t('privacyLink')}
          </Link>
          <span aria-hidden="true">·</span>
          <span>
            {t.rich('madeWith', {
              link: (chunks) => (
                <a href={PROJECT_REPOSITORY_URL} rel="noopener noreferrer" target="_blank" className={LINK}>
                  {chunks}
                </a>
              ),
            })}
          </span>
        </p>
      </div>
    </footer>
  );
}
