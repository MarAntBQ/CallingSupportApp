import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createTranslator } from 'next-intl';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import pt from '../../../messages/pt.json';
import { isLocale, type Locale } from '@/i18n/config';
import { decrypt, encrypt } from '@/server/crypto/aes';
import type { Database } from '@/server/db';
import { appConfig, users } from '@/server/db/schema';
import { telegramClient, type TelegramClient } from './client';

const MESSAGES = { es, pt, en };

const WEBHOOK_PATH = '/api/telegram/webhook';
type MakeClient = (token: string) => TelegramClient;

async function loadConfig(db: Database) {
  const [row] = await db
    .select({ tokenEnc: appConfig.telegramBotTokenEnc, username: appConfig.telegramBotUsername, secretEnc: appConfig.telegramWebhookSecretEnc })
    .from(appConfig)
    .where(eq(appConfig.id, 1))
    .limit(1);
  return row ?? null;
}

export async function getTelegramConfig(db: Database): Promise<{ botUsername: string | null; hasToken: boolean }> {
  const row = await loadConfig(db);
  return { botUsername: row?.username ?? null, hasToken: Boolean(row?.tokenEnc) };
}

export type TelegramConfigResult = { ok: true; botUsername: string } | { ok: false; error: string };

// Guarda el bot cifrado y registra el webhook. Si Telegram rechaza el token/URL, NO guarda nada.
export async function saveTelegramConfig(
  db: Database,
  input: { botToken: string; botUsername: string },
  options: { baseUrl: string; makeClient?: MakeClient },
): Promise<TelegramConfigResult> {
  const makeClient = options.makeClient ?? telegramClient;
  const secret = randomBytes(24).toString('hex');
  const webhook = await makeClient(input.botToken).setWebhook(`${options.baseUrl}${WEBHOOK_PATH}`, secret);
  if (!webhook.ok) return { ok: false, error: webhook.error };
  await db
    .update(appConfig)
    .set({ telegramBotTokenEnc: encrypt(input.botToken), telegramBotUsername: input.botUsername, telegramWebhookSecretEnc: encrypt(secret) })
    .where(eq(appConfig.id, 1));
  return { ok: true, botUsername: input.botUsername };
}

export async function testTelegram(db: Database, options: { makeClient?: MakeClient } = {}): Promise<TelegramConfigResult> {
  const makeClient = options.makeClient ?? telegramClient;
  const row = await loadConfig(db);
  if (!row?.tokenEnc) return { ok: false, error: 'no_bot' };
  const me = await makeClient(decrypt(row.tokenEnc)).getMe();
  return me.ok ? { ok: true, botUsername: me.data.username } : { ok: false, error: me.error };
}

export type LinkResult = { ok: true; url: string } | { ok: false; error: 'no_bot' };

export async function linkTelegram(db: Database, userId: string): Promise<LinkResult> {
  const row = await loadConfig(db);
  if (!row?.tokenEnc || !row.username) return { ok: false, error: 'no_bot' };
  const code = randomBytes(8).toString('hex');
  await db.update(users).set({ telegramLinkCode: code }).where(eq(users.id, userId));
  return { ok: true, url: `https://t.me/${row.username}?start=${code}` };
}

export async function unlinkTelegram(db: Database, userId: string): Promise<void> {
  await db.update(users).set({ telegramChatId: null, telegramLinkCode: null }).where(eq(users.id, userId));
}

export async function verifyWebhookSecret(db: Database, headerSecret: string | null): Promise<boolean> {
  const row = await loadConfig(db);
  if (!row?.secretEnc) return false;
  const expected = Buffer.from(decrypt(row.secretEnc));
  const got = Buffer.from(headerSecret ?? '');
  return expected.length === got.length && timingSafeEqual(expected, got);
}

type StartMessages = { noCode: string; unknownCode: string; linked: string };

// Mensajes del bot en el idioma de la unidad (el webhook no tiene contexto de request).
export function botStartMessages(locale: string | null): StartMessages {
  const lang: Locale = isLocale(locale) ? locale : 'es';
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'telegram' });
  return { noCode: t('start.noCode'), unknownCode: t('start.unknownCode'), linked: t('start.linked') };
}

// Procesa un update de Telegram. Solo atiende /start. Devuelve el chat y el texto a responder, o
// null si no hay nada que contestar. El vínculo guarda el chat y consume el código de un solo uso.
export async function handleTelegramUpdate(
  db: Database,
  update: unknown,
  messages: StartMessages,
): Promise<{ chatId: string; text: string } | null> {
  const message = (update as { message?: { text?: unknown; chat?: { id?: unknown } } } | null)?.message;
  const chatId = message?.chat?.id;
  if (chatId === undefined || chatId === null) return null;
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  const match = /^\/start(?:\s+(\S+))?$/.exec(text);
  if (!match) return null;
  const code = match[1];
  if (!code) return { chatId: String(chatId), text: messages.noCode };
  const updated = await db.update(users).set({ telegramChatId: String(chatId), telegramLinkCode: null }).where(eq(users.telegramLinkCode, code)).returning({ id: users.id });
  return { chatId: String(chatId), text: updated.length > 0 ? messages.linked : messages.unknownCode };
}

export type TelegramSender = (chatId: string, text: string) => Promise<unknown>;

// Sender para los avisos de módulo (#17): si hay bot configurado, devuelve una función que envía por
// Telegram; si no, null (no se envía nada). Carga el token una vez.
export async function telegramSenderFor(db: Database, makeClient: MakeClient = telegramClient): Promise<TelegramSender | null> {
  const row = await loadConfig(db);
  if (!row?.tokenEnc) return null;
  const client = makeClient(decrypt(row.tokenEnc));
  return (chatId, text) => client.sendMessage(chatId, text);
}
