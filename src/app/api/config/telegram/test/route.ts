import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { testTelegram } from '@/server/telegram/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(
  async () => {
    const result = await testTelegram(getDb());
    if (!result.ok) {
      return NextResponse.json({ error: 'invalid_input', fields: ['botToken'], issues: [{ field: 'botToken', code: 'telegram_rejected', message: result.error }] }, { status: 400 });
    }
    return NextResponse.json({ botUsername: result.botUsername });
  },
  { permission: 'global-admin' },
);
