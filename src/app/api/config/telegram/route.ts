import { NextResponse } from 'next/server';
import { telegramConfigSchema } from '@/lib/validation/telegram';
import { invalidInputResponse } from '@/server/auth/errors';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { getTelegramConfig, saveTelegramConfig } from '@/server/telegram/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth(async () => NextResponse.json(await getTelegramConfig(getDb())), { permission: 'global-admin' });

export const POST = withAuth(
  async (request) => {
    const body = telegramConfigSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidInputResponse(body.error);
    // La URL pública del webhook: APP_URL si está (canónica, detrás de proxy), si no el origin.
    const baseUrl = process.env.APP_URL?.trim().replace(/\/+$/, '') || new URL(request.url).origin;
    const result = await saveTelegramConfig(getDb(), body.data, { baseUrl });
    if (!result.ok) {
      return NextResponse.json({ error: 'invalid_input', fields: ['botToken'], issues: [{ field: 'botToken', code: 'telegram_rejected', message: result.error }] }, { status: 400 });
    }
    return NextResponse.json({ botUsername: result.botUsername });
  },
  { permission: 'global-admin' },
);
