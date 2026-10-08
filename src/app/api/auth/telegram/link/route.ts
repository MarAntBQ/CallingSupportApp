import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { linkTelegram } from '@/server/telegram/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (_request, { session }) => {
  const result = await linkTelegram(getDb(), session.user.id);
  if (!result.ok) return NextResponse.json({ error: 'invalid_input', fields: ['telegram'], issues: [{ field: 'telegram', code: result.error }] }, { status: 400 });
  return NextResponse.json({ url: result.url });
});
