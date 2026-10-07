import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';

export async function AuthShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <main className="flex w-full max-w-lg flex-1 flex-col justify-center">
        <p className="mb-6 text-center text-lg font-semibold text-primary">{t('appName')}</p>
        <div className="rounded-md border border-border bg-surface p-6 shadow-md sm:p-8">
          <h1 className="text-2xl font-semibold text-text">{title}</h1>
          {intro && <p className="mt-2 text-text-muted">{intro}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <footer className="mt-8 flex flex-col items-center gap-4 text-center">
        <LocaleSwitcher />
        <p className="max-w-md text-sm text-text-muted">{t('notOfficial')}</p>
      </footer>
    </div>
  );
}
