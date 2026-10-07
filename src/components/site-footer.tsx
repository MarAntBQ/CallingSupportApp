'use client';

import { useTranslations } from 'next-intl';
import { useConfig } from '@/lib/config/use-config';

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
      </div>
    </footer>
  );
}
