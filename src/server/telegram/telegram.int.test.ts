import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decrypt } from '@/server/crypto/aes';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { notifyModuleEvent } from '@/server/notifications/service';
import type { TelegramClient } from '@/server/telegram/client';
import { getTelegramConfig, linkTelegram, saveTelegramConfig, testTelegram, unlinkTelegram } from '@/server/telegram/service';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

function mockClient() {
  const calls: { setWebhook: { url: string; secret: string }[]; sendMessage: { chatId: string; text: string }[] } = { setWebhook: [], sendMessage: [] };
  const make = (): TelegramClient => ({
    getMe: async () => ({ ok: true, data: { username: 'mibot' } }),
    setWebhook: async (webhookUrl, secret) => {
      calls.setWebhook.push({ url: webhookUrl, secret });
      return { ok: true, data: true };
    },
    sendMessage: async (chatId, text) => {
      calls.sendMessage.push({ chatId, text });
      return { ok: true, data: true };
    },
  });
  return { make, calls };
}

describe.skipIf(!url)('telegram contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let webhook: typeof import('@/app/api/telegram/webhook/route');

  async function ensureConfigRow() {
    await db.insert(schema.appConfig).values({ id: 1, unitName: 'Barrio', defaultLocale: 'es' }).onConflictDoNothing();
  }

  async function addLeaderWithNotify(email: string, over: Record<string, unknown> = {}) {
    const [role] = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.key, 'leader'));
    const [user] = await db.insert(schema.users).values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: 'x', roleId: role!.id, status: 'active', ...over }).returning();
    const [org] = await db.insert(schema.organizations).values({ name: `Org ${email}` }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: org!.id, name: 'Líder' }).returning();
    await db.insert(schema.modulePermissions).values({ module: 'temple-trips', callingId: calling!.id, canNotify: true });
    await db.insert(schema.userCallings).values({ userId: user!.id, callingId: calling!.id });
    return user!;
  }

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) throw new Error('TEST_DATABASE_URL debe contener "test"');
    process.env.DATABASE_URL = url;
    process.env.ENC_KEY = process.env.ENC_KEY ?? randomBytes(32).toString('hex');
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;');
    await migrate(drizzle(admin), { migrationsFolder: MIGRATIONS });
    await admin.end();
    pool = new Pool({ connectionString: url, max: 2 });
    db = drizzle(pool, { schema });
    webhook = await import('@/app/api/telegram/webhook/route');
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table user_callings, module_permissions, callings, organizations, users, app_config restart identity cascade`);
    await ensureConfigRow();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('guardar el bot cifra el token, registra el webhook y no expone el token', async () => {
    const { make, calls } = mockClient();
    const result = await saveTelegramConfig(db, { botToken: 'TOKEN-super-secreto-1234567', botUsername: 'mibot' }, { baseUrl: 'https://app.example', makeClient: make });
    expect(result.ok).toBe(true);
    expect(calls.setWebhook).toHaveLength(1);
    expect(calls.setWebhook[0]!.url).toBe('https://app.example/api/telegram/webhook');
    const [row] = await db.select({ tokenEnc: schema.appConfig.telegramBotTokenEnc }).from(schema.appConfig).where(eq(schema.appConfig.id, 1));
    expect(row!.tokenEnc).not.toContain('TOKEN-super-secreto'); // guardado cifrado
    expect(decrypt(row!.tokenEnc!)).toBe('TOKEN-super-secreto-1234567');
    // getTelegramConfig nunca devuelve el token
    const config = await getTelegramConfig(db);
    expect(config).toEqual({ botUsername: 'mibot', hasToken: true });
    expect(JSON.stringify(config)).not.toContain('TOKEN');
    // testTelegram usa getMe
    expect(await testTelegram(db, { makeClient: make })).toEqual({ ok: true, botUsername: 'mibot' });
  });

  it('si Telegram rechaza el setWebhook, no se guarda nada', async () => {
    const make = (): TelegramClient => ({
      getMe: async () => ({ ok: false, error: 'bad token' }),
      setWebhook: async () => ({ ok: false, error: 'Unauthorized' }),
      sendMessage: async () => ({ ok: true, data: true }),
    });
    const result = await saveTelegramConfig(db, { botToken: 'TOKEN-malo-123456789012', botUsername: 'mibot' }, { baseUrl: 'https://app.example', makeClient: make });
    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    const [row] = await db.select({ tokenEnc: schema.appConfig.telegramBotTokenEnc }).from(schema.appConfig).where(eq(schema.appConfig.id, 1));
    expect(row!.tokenEnc).toBeNull();
  });

  it('el webhook rechaza con 401 si el secreto no coincide y no cambia nada', async () => {
    const { make } = mockClient();
    await saveTelegramConfig(db, { botToken: 'TOKEN-super-secreto-1234567', botUsername: 'mibot' }, { baseUrl: 'https://app.example', makeClient: make });
    const user = await addLeaderWithNotify('lider@example.com');
    const link = await linkTelegram(db, user.id);
    const code = link.ok ? new URL(link.url).searchParams.get('start') : null;
    const request = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'equivocado' },
      body: JSON.stringify({ message: { chat: { id: 555 }, text: `/start ${code}` } }),
    });
    const response = await webhook.POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
    const [after] = await db.select({ chatId: schema.users.telegramChatId }).from(schema.users).where(eq(schema.users.id, user.id));
    expect(after!.chatId).toBeNull();
  });

  it('con el secreto correcto, /start <código> vincula la cuenta y responde el mensaje de éxito', async () => {
    const { make } = mockClient();
    await saveTelegramConfig(db, { botToken: 'TOKEN-super-secreto-1234567', botUsername: 'mibot' }, { baseUrl: 'https://app.example', makeClient: make });
    const [cfg] = await db.select({ secretEnc: schema.appConfig.telegramWebhookSecretEnc }).from(schema.appConfig).where(eq(schema.appConfig.id, 1));
    const secret = decrypt(cfg!.secretEnc!);
    const user = await addLeaderWithNotify('lider@example.com');
    const link = await linkTelegram(db, user.id);
    const code = link.ok ? new URL(link.url).searchParams.get('start') : null;
    expect(code).toBeTruthy();

    const call = (body: unknown) =>
      webhook.POST(new Request('http://localhost/api/telegram/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(body) }), { params: Promise.resolve({}) });

    const ok = await call({ message: { chat: { id: 777 }, text: `/start ${code}` } });
    expect(ok.status).toBe(200);
    const okBody = await ok.json();
    expect(okBody.method).toBe('sendMessage');
    expect(okBody.chat_id).toBe('777');
    expect(okBody.text).toContain('vinculada');
    const [after] = await db.select({ chatId: schema.users.telegramChatId, code: schema.users.telegramLinkCode }).from(schema.users).where(eq(schema.users.id, user.id));
    expect(after!.chatId).toBe('777');
    expect(after!.code).toBeNull();

    // Un código ya usado o inexistente responde "no válido" y no vincula otro chat.
    const unknown = await call({ message: { chat: { id: 888 }, text: `/start ${code}` } });
    expect((await unknown.json()).text).toContain('no es válido');

    // unlink limpia el chat
    await unlinkTelegram(db, user.id);
    const [cleared] = await db.select({ chatId: schema.users.telegramChatId }).from(schema.users).where(eq(schema.users.id, user.id));
    expect(cleared!.chatId).toBeNull();
  });

  it('notifyModuleEvent envía por Telegram solo a los destinatarios vinculados', async () => {
    const linked = await addLeaderWithNotify('conlink@example.com', { telegramChatId: '111' });
    await addLeaderWithNotify('sinlink@example.com');
    const sent: { chatId: string; text: string }[] = [];
    const build = () => ({ subject: 'S', html: '<p>h</p>', telegramText: 'Hay 2 inscripciones nuevas' });
    const result = await notifyModuleEvent('temple-trips', build, {
      db,
      mailer: async () => ({ sent: true }),
      telegramSender: async (chatId, text) => void sent.push({ chatId, text }),
    });
    expect(result.recipients).toBe(2);
    expect(sent).toEqual([{ chatId: '111', text: 'Hay 2 inscripciones nuevas' }]);
    expect(linked.telegramChatId).toBe('111');
  });
});
