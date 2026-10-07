import { describe, expect, it } from 'vitest';
import { POST } from './route';

function post(body: string) {
  return POST(
    new Request('http://localhost/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
      body,
    }),
  );
}

describe('POST /api/locale', () => {
  it.each(['es', 'pt', 'en'])('guarda %s en la cookie csa_locale por un año', async (locale) => {
    const res = await post(JSON.stringify({ locale }));
    expect(res.status).toBe(204);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`csa_locale=${locale}`);
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).toContain('Path=/');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(cookie).toContain('HttpOnly');
  });

  it.each([
    ['un idioma no soportado', JSON.stringify({ locale: 'fr' })],
    ['un idioma con región', JSON.stringify({ locale: 'pt-BR' })],
    ['un cuerpo sin idioma', JSON.stringify({})],
    ['un JSON inválido', '{locale'],
  ])('responde 400 sin cookie ante %s', async (_case, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
