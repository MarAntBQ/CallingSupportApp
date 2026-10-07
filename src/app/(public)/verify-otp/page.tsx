import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getSession } from '@/server/auth/session';
import { VerifyOtpForm } from './verify-otp-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('verifyOtp');
  return { title: t('title') };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (await getSession()) redirect('/admin');
  const t = await getTranslations('verifyOtp');
  const { email } = await searchParams;

  return (
    <AuthShell title={t('title')} showUnit>
      <VerifyOtpForm initialEmail={typeof email === 'string' ? email.slice(0, 254) : ''} />
    </AuthShell>
  );
}
