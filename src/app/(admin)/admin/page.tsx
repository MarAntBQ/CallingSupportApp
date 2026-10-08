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
  if (isGlobalAdmin(session)) redirect('/admin/dashboard');
  const home = moduleHome(await allowedModules(getDb(), session.user));
  if (home) redirect(home);
  const t = await getTranslations('admin');

  // Aquí solo llega un usuario autenticado que no es SuperAdmin y no tiene módulos asignados
  // (el SuperAdmin fue a /admin/dashboard y quien tiene módulos, a su módulo).
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('welcome', { name: session.user.firstName })}</h1>
      </div>
      <Alert tone="info" role="status" title={t('noModules')} />
    </section>
  );
}
