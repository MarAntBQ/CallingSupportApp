import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { currentConfig } from '@/server/config/current';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { isSetupNeeded } from '@/server/setup/service';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

const MESSAGES = ['logged_out', 'account_verified', 'password_reset'] as const;

const LINK = 'font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (await isSetupNeeded(getDb())) redirect('/setup');
  if (await getSession()) redirect('/admin');

  const t = await getTranslations('login');
  const { message } = await searchParams;
  const known = MESSAGES.find((key) => key === message);
  const { allowRegistration } = await currentConfig();

  return (
    <AuthShell title={t('title')} showUnit>
      <LoginForm message={known ? t(`messages.${known}`) : undefined} />
      <p className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/forgot-password" className={LINK}>
          {t('forgot')}
        </Link>
        {allowRegistration && (
          <Link href="/register" className={LINK}>
            {t('register')}
          </Link>
        )}
      </p>
    </AuthShell>
  );
}
