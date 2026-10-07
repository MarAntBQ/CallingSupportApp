import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 text-center">
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1>
          <Logo priority className="h-14 w-auto sm:h-16" />
        </h1>
        <p className="text-text-muted">{t('home.underConstruction')}</p>
        <Link
          href="/login"
          className="rounded-sm bg-primary px-5 py-2 font-medium text-on-primary hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('home.loginLink')}
        </Link>
        <p className="rounded-full border border-border bg-surface px-4 py-1 text-sm shadow-sm">
          <a
            href="https://callingsupportapp.org"
            className="font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline"
          >
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
