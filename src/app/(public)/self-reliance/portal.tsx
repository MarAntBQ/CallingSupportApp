'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import type { Locale } from '@/i18n/config';
import { RESOURCE_CATEGORIES, type ResourceCategory } from '@/lib/self-reliance/constants';
import type { PublicResource } from '@/lib/validation/self-reliance';

const CONTROL =
  'w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary';

const LANGUAGE_FILTERS = ['es', 'pt', 'en', 'any'] as const;
type LanguageFilter = (typeof LANGUAGE_FILTERS)[number];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function SelfReliancePortal({
  unitName,
  logoDataUrl,
  locale,
  resources,
}: {
  unitName: string;
  logoDataUrl: string | null;
  locale: Locale;
  resources: PublicResource[];
}) {
  const t = useTranslations('selfReliance');
  const categoryId = useId();
  const languageId = useId();
  const searchId = useId();
  const [category, setCategory] = useState<ResourceCategory | ''>('');
  const [language, setLanguage] = useState<LanguageFilter>(locale);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const query = normalize(search.trim());
    return resources.filter(
      (resource) =>
        (!category || resource.category === category) &&
        (language === 'any' || resource.locale === 'all' || resource.locale === language) &&
        (!query || normalize(`${resource.title} ${resource.description ?? ''} ${t(`categories.${resource.category}`)}`).includes(query)),
    );
  }, [resources, category, language, search, t]);

  const official = visible.filter((resource) => resource.official);
  const others = visible.filter((resource) => !resource.official);
  const groups = RESOURCE_CATEGORIES.map((key) => ({ key, items: others.filter((resource) => resource.category === key) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo del data-URL de la unidad, no optimizable por next/image
          <img src={logoDataUrl} alt={unitName} className="h-14 w-auto" />
        ) : (
          <span className="text-lg font-semibold text-text">{unitName}</span>
        )}
        <h1 className="text-2xl font-semibold text-text">{t('portal.title')}</h1>
        <p className="text-text-muted">{t('portal.intro')}</p>
      </header>

      <section aria-label={t('portal.filters')} className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={categoryId} className="text-sm font-medium text-text-muted">
            {t('portal.category')}
          </label>
          <select id={categoryId} className={CONTROL} value={category} onChange={(event) => setCategory(event.target.value as ResourceCategory | '')}>
            <option value="">{t('portal.allCategories')}</option>
            {RESOURCE_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {t(`categories.${key}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={languageId} className="text-sm font-medium text-text-muted">
            {t('portal.language')}
          </label>
          <select id={languageId} className={CONTROL} value={language} onChange={(event) => setLanguage(event.target.value as LanguageFilter)}>
            {LANGUAGE_FILTERS.map((key) => (
              <option key={key} value={key}>
                {t(`portal.languages.${key}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={searchId} className="text-sm font-medium text-text-muted">
            {t('portal.search')}
          </label>
          <input id={searchId} type="search" className={CONTROL} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>

      {visible.length === 0 && (
        <p role="status" className="text-center text-text-muted">
          {t('portal.empty')}
        </p>
      )}

      {official.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby={`${categoryId}-official`}>
          <h2 id={`${categoryId}-official`} className="text-xl font-semibold text-text">
            {t('portal.officialTitle')}
          </h2>
          <ResourceList items={official} />
        </section>
      )}

      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-3" aria-labelledby={`${categoryId}-${group.key}`}>
          <h2 id={`${categoryId}-${group.key}`} className="text-xl font-semibold text-text">
            {t(`categories.${group.key}`)}
          </h2>
          <ResourceList items={group.items} />
        </section>
      ))}

      <footer className="flex flex-col items-center gap-2 border-t border-border pt-4 text-center text-sm text-text-muted">
        <p>{t('portal.freeOnly')}</p>
        <LocaleSwitcher />
      </footer>
    </div>
  );
}

function ResourceList({ items }: { items: PublicResource[] }) {
  const t = useTranslations('selfReliance');
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((resource) => (
        <li key={resource.id} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4" data-testid="portal-resource">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">{t(`categories.${resource.category}`)}</span>
            {resource.official && (
              <span className="rounded-sm border border-primary px-1.5 py-0.5 text-xs font-medium text-primary">{t('official')}</span>
            )}
          </div>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1.5 text-base font-semibold break-words text-primary underline-offset-4 hover:text-primary-strong hover:underline"
          >
            {resource.title}
            <ExternalIcon />
            <span className="sr-only">{t('portal.newTab')}</span>
          </a>
          {resource.description && <p className="text-sm text-text-muted">{resource.description}</p>}
        </li>
      ))}
    </ul>
  );
}

function ExternalIcon() {
  return (
    <svg aria-hidden="true" data-testid="external-icon" viewBox="0 0 20 20" className="mt-1 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M11 3h6v6M17 3l-8 8M15 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
