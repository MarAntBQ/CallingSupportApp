import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { unlinkTelegram } from '@/server/telegram/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (_request, { session }) => {
  await unlinkTelegram(getDb(), session.user.id);
  return NextResponse.json({ ok: true });
});
