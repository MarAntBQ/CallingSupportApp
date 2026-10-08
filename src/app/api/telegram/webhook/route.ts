import { NextResponse } from 'next/server';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { publicRoute } from '@/server/security/route';
import { botStartMessages, handleTelegramUpdate, verifyWebhookSecret } from '@/server/telegram/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export const POST = publicRoute(
  async (request) => {
    const db = getDb();
    if (!(await verifyWebhookSecret(db, request.headers.get(SECRET_HEADER)))) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const update = await request.json().catch(() => null);
    const config = await getConfig(db);
    const reply = await handleTelegramUpdate(db, update, botStartMessages(config.defaultLocale));
    // Siempre 200 a Telegram; si hay respuesta, se devuelve como método en el cuerpo (sin 2ª llamada).
    if (!reply) return NextResponse.json({ ok: true });
    return NextResponse.json({ method: 'sendMessage', chat_id: reply.chatId, text: reply.text });
  },
  { reason: 'Telegram llama a este webhook; se valida el secreto del encabezado X-Telegram-Bot-Api-Secret-Token' },
);
