import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { moduleHome } from '@/lib/modules';
import { getSession } from '@/server/auth/session';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { allowedModules } from '@/server/permissions/service';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isGlobalAdmin(session)) {
    const home = moduleHome(await allowedModules(getDb(), session.user));
    if (home) redirect(home);
  }
  const t = await getTranslations('admin');

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('welcome', { name: session.user.firstName })}</h1>
        {isGlobalAdmin(session) && <p className="text-text-muted">{t('welcomeBody')}</p>}
      </div>
      {!isGlobalAdmin(session) && <Alert tone="info" role="status" title={t('noModules')} />}
    </section>
  );
}
