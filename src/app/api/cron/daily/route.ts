import { NextResponse } from 'next/server';
import { purgeStaleSessions } from '@/server/auth/sessions';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { purgeExpiredMailLogs } from '@/server/mail/service';
import { assertCronRequest } from '@/server/security/cron';
import { publicRoute } from '@/server/security/route';
import { purgeExpiredRegistrations } from '@/server/temple-trips/registrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = publicRoute(
  async (request) => {
    assertCronRequest(request);
    const db = getDb();
    const config = await getConfig(db);
    const deletedEmailLogs = await purgeExpiredMailLogs(db);
    const deletedSessions = await purgeStaleSessions(db);
    const { purgedRegistrations, purgedParticipants } = await purgeExpiredRegistrations(db, {
      timeZone: config.timezone,
      retentionMonths: config.retentionMonths,
    });
    // Solo números; nunca datos de personas (#26, Manual 33.8).
    console.info(JSON.stringify({ event: 'cron_daily', purgedRegistrations, purgedParticipants, deletedSessions, deletedEmailLogs }));
    return NextResponse.json({ purgedRegistrations, purgedParticipants, deletedSessions, deletedEmailLogs });
  },
  { reason: 'la llama Vercel Cron una vez al día; exige Authorization: Bearer CRON_SECRET' },
);
