import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { isGlobalAdmin } from '@/server/auth/sessions';
import { currentConfig } from '@/server/config/current';
import { getDb } from '@/server/db';
import { listMailLogs, LOG_LIMIT } from '@/server/mail/service';
import { MailLogTable } from './mail-log-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mailLogs');
  return { title: t('title') };
}

export default async function MailLogsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isGlobalAdmin(session)) redirect('/admin');
  const t = await getTranslations('mailLogs');
  const [logs, config] = await Promise.all([listMailLogs(getDb()), currentConfig()]);
  const rows = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    source: log.source,
    to: log.emailTo,
    subject: log.emailSubject,
    success: log.success,
    error: log.errorMessage,
  }));

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text">{t('title')}</h1>
        <p className="text-text-muted">{t('intro', { limit: LOG_LIMIT })}</p>
      </div>
      <MailLogTable rows={rows} timeZone={config.timezone} />
    </section>
  );
}
