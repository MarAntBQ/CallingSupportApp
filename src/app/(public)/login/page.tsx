import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { isSetupNeeded } from '@/server/setup/service';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

const MESSAGES = ['logged_out'] as const;

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

  return (
    <AuthShell title={t('title')} showUnit>
      <LoginForm message={known ? t(`messages.${known}`) : undefined} />
    </AuthShell>
  );
}
