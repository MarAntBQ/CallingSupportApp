import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { purgeExpiredMailLogs } from '@/server/mail/service';
import { assertCronRequest } from '@/server/security/cron';
import { publicRoute } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = publicRoute(
  async (request) => {
    assertCronRequest(request);
    const deletedEmailLogs = await purgeExpiredMailLogs(getDb());
    console.info(JSON.stringify({ event: 'cron_daily', deletedEmailLogs }));
    return NextResponse.json({ deletedEmailLogs });
  },
  { reason: 'la llama Vercel Cron una vez al día; exige Authorization: Bearer CRON_SECRET' },
);
