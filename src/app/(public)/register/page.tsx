import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { Alert } from '@/components/ui/alert';
import { getSession } from '@/server/auth/session';
import { currentConfig } from '@/server/config/current';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('register');
  return { title: t('title') };
}

export default async function RegisterPage() {
  if (await getSession()) redirect('/admin');
  const t = await getTranslations('register');
  const { allowRegistration } = await currentConfig();

  return (
    <AuthShell title={allowRegistration ? t('title') : t('closedTitle')} intro={allowRegistration ? t('intro') : undefined} showUnit>
      {allowRegistration ? (
        <RegisterForm />
      ) : (
        <Alert tone="info" role="status" title={t('closedTitle')}>
          {t('closedBody')}
        </Alert>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:text-primary-strong hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}
