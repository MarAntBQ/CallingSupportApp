import 'server-only';

// Cliente mínimo de la API de Telegram (#17). `fetchImpl` es inyectable para las pruebas: así no
// se llama a la red real. Nunca lanza: devuelve ok/error.
const API_BASE = 'https://api.telegram.org';

export type TelegramResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type TelegramClient = {
  getMe(): Promise<TelegramResult<{ username: string }>>;
  setWebhook(url: string, secret: string): Promise<TelegramResult<true>>;
  sendMessage(chatId: string, text: string): Promise<TelegramResult<true>>;
};

async function call<T>(token: string, method: string, params: Record<string, unknown>, fetchImpl: typeof fetch): Promise<TelegramResult<T>> {
  try {
    const response = await fetchImpl(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    if (!response.ok || !body?.ok) return { ok: false, error: String(body?.description ?? `telegram_http_${response.status}`) };
    return { ok: true, data: body.result as T };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export function telegramClient(token: string, fetchImpl: typeof fetch = fetch): TelegramClient {
  return {
    getMe: () => call<{ username: string }>(token, 'getMe', {}, fetchImpl),
    setWebhook: (url, secret) => call<true>(token, 'setWebhook', { url, secret_token: secret, allowed_updates: ['message'] }, fetchImpl),
    sendMessage: (chatId, text) => call<true>(token, 'sendMessage', { chat_id: chatId, text }, fetchImpl),
  };
}
