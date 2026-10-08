import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { users } from '@/server/db/schema';
import { getTelegramConfig } from '@/server/telegram/service';
import { ProfileForm } from './profile-form';
import { TelegramProfileCard } from './telegram-profile-card';

export const dynamic = 'force-dynamic';

const ROLE_KEYS = ['super_admin', 'leader', 'member', 'friend'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return { title: t('title') };
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('profile');
  const tRoles = await getTranslations('roles');
  const locale = await getLocale();
  const db = getDb();
  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, phone: users.phone, callingLabel: users.callingLabel, telegramChatId: users.telegramChatId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user) redirect('/login');
  const telegram = await getTelegramConfig(db);
  const roleKey = ROLE_KEYS.find((key) => key === session.user.role.key);
  const role = user.callingLabel || (roleKey ? tRoles(roleKey) : session.user.role.name);

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex min-w-0 gap-1.5">
            <dt className="text-text-muted">{t('email')}:</dt>
            <dd className="break-all text-text" data-testid="profile-email">
              {session.user.email}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-text-muted">{t('role')}:</dt>
            <dd className="text-text">{role}</dd>
          </div>
        </dl>
        <p className="text-sm text-text-muted">{t('emailHint')}</p>
      </div>
      <ProfileForm
        initial={{ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' }}
        locale={locale}
      />
      <TelegramProfileCard linked={Boolean(user.telegramChatId)} botConfigured={telegram.hasToken} />
    </section>
  );
}
