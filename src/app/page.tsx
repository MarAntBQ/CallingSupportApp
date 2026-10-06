import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 text-center">
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-semibold text-brown-700">{t('common.appName')}</h1>
        <p className="text-text-muted">{t('home.underConstruction')}</p>
        <p className="rounded-full border border-border bg-surface px-4 py-1 text-sm text-sage-600">
          <a href="https://callingsupportapp.org" className="underline-offset-4 hover:underline">
            {t('home.docsLink')}
          </a>
        </p>
      </main>
      <footer className="py-8">
        <LocaleSwitcher />
      </footer>
    </div>
  );
}
