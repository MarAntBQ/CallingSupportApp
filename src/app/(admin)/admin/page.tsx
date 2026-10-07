import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';

export default async function AdminHomePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('admin');

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold text-text">{t('welcome', { name: session.user.firstName })}</h1>
      <p className="text-text-muted">{t('welcomeBody')}</p>
    </section>
  );
}
