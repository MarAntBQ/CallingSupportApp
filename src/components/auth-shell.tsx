import Link from 'next/link';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Logo } from '@/components/logo';
import { UnitBrand } from '@/components/unit-brand';

export function AuthShell({
  title,
  intro,
  showUnit = false,
  children,
}: {
  title: string;
  intro?: string;
  showUnit?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <main className="flex w-full max-w-lg flex-1 flex-col justify-center">
        <Link
          href="/"
          className="mx-auto mb-6 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Logo priority className="h-10 w-auto sm:h-12" />
        </Link>
        <div className="rounded-md border border-border bg-surface p-6 shadow-md sm:p-8">
          {showUnit && <UnitBrand size={48} className="mb-5" />}
          <h1 className="text-2xl font-semibold text-text">{title}</h1>
          {intro && <p className="mt-2 text-text-muted">{intro}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <div className="mt-8 flex justify-center">
        <LocaleSwitcher />
      </div>
    </div>
  );
}
