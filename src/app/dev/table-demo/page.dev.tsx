import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { TableDemo } from './table-demo';

export default async function TableDemoPage() {
  const t = await getTranslations('tableDemo');

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
          <p className="text-text-muted">{t('body')}</p>
        </div>
        <LocaleSwitcher />
      </header>
      <TableDemo />
    </main>
  );
}
