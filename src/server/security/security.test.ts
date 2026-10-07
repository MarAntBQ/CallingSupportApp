import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@/server/auth/errors';

const requireSessionFromRequest = vi.fn();

vi.mock('@/server/auth/session', () => ({ requireSessionFromRequest: (...args: unknown[]) => requireSessionFromRequest(...args) }));

const { clientIp, isSameOrigin, privateHash } = await import('./http');
const { publicRoute, withAuth } = await import('./route');

const adminSession = { id: 's1', expiresAt: new Date(), user: { id: 'u1', role: { key: 'super_admin', name: 'SuperAdmin', level: 100 } } };
const memberSession = { ...adminSession, user: { ...adminSession.user, role: { key: 'member', name: 'Miembro', level: 10 } } };

function request(method: string, headers: Record<string, string> = {}) {
  return new Request('https://staging.callingsupportapp.org/api/x', { method, headers });
}

describe('isSameOrigin', () => {
  it('deja pasar GET y HEAD sin Origin', () => {
    expect(isSameOrigin(request('GET'))).toBe(true);
    expect(isSameOrigin(request('HEAD'))).toBe(true);
  });

  it('acepta un POST desde el mismo sitio', () => {
    expect(isSameOrigin(request('POST', { origin: 'https://staging.callingsupportapp.org' }))).toBe(true);
  });

  it('rechaza un POST desde otro sitio, sin Origin o con Origin "null"', () => {
    expect(isSameOrigin(request('POST', { origin: 'https://otro-sitio.example' }))).toBe(false);
    expect(isSameOrigin(request('POST'))).toBe(false);
    expect(isSameOrigin(request('DELETE', { origin: 'null' }))).toBe(false);
    expect(isSameOrigin(request('PUT', { origin: 'no es una url' }))).toBe(false);
  });

  it('respeta el host original detrás del proxy de Vercel', () => {
    const behindProxy = new Request('https://callingsupportapp-abc.vercel.app/api/x', {
      method: 'POST',
      headers: { origin: 'https://staging.callingsupportapp.org', 'x-forwarded-host': 'staging.callingsupportapp.org' },
    });
    expect(isSameOrigin(behindProxy)).toBe(true);
  });
});

describe('clientIp y privateHash', () => {
  it('toma la primera IP de x-forwarded-for', () => {
    expect(clientIp(request('GET', { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIp(request('GET'))).toBe('unknown');
  });

  it('no guarda la IP ni el correo en claro y normaliza mayúsculas', () => {
    const key = privateHash('login:email', 'Ana@Example.com');
    expect(key).toMatch(/^login:email:[0-9a-f]{64}$/);
    expect(key).not.toContain('ana');
    expect(privateHash('login:email', 'ana@example.com')).toBe(key);
    expect(privateHash('login:ip', '203.0.113.7')).not.toBe(privateHash('setup:ip', '203.0.113.7'));
  });
});

describe('withAuth y publicRoute', () => {
  beforeEach(() => {
    requireSessionFromRequest.mockReset();
  });

  it('withAuth sin sesión responde 401 y no ejecuta el handler', async () => {
    requireSessionFromRequest.mockImplementation(async () => {
      throw new AuthError(401, 'unauthenticated');
    });
    const handler = vi.fn();
    const response = await withAuth(handler)(request('GET'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('withAuth con permiso global-admin responde 403 a un miembro', async () => {
    requireSessionFromRequest.mockResolvedValue(memberSession);
    const handler = vi.fn();
    const response = await withAuth(handler, { permission: 'global-admin' })(request('GET'));
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('withAuth pasa la sesión y los parámetros al handler', async () => {
    requireSessionFromRequest.mockResolvedValue(adminSession);
    const route = withAuth<{ id: string }>(async (_request, { session, params }) =>
      Response.json({ user: session.user.id, id: params.id }),
    );
    const response = await route(request('GET'), { params: Promise.resolve({ id: '42' }) });
    expect(await response.json()).toEqual({ user: 'u1', id: '42' });
  });

  it('un POST desde otro sitio responde 403 bad_origin antes de mirar la sesión', async () => {
    const handler = vi.fn();
    for (const route of [withAuth(handler), publicRoute(handler, { reason: 'prueba' })]) {
      const response = await route(request('POST', { origin: 'https://otro-sitio.example' }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'bad_origin' });
    }
    expect(handler).not.toHaveBeenCalled();
    expect(requireSessionFromRequest).not.toHaveBeenCalled();
  });

  it('un error inesperado responde 500 con un id, sin traza ni mensaje', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const route = publicRoute(
      async () => {
        throw new Error('select * from users where email = ana@example.com password=secreta');
      },
      { reason: 'prueba' },
    );
    const response = await route(request('GET'));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: 'internal_error', id: expect.any(String) });
    expect(text).not.toMatch(/select|ana@|secreta|at /);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/ana@|secreta/);
    spy.mockRestore();
  });

  it('el 429 lleva Retry-After', async () => {
    const route = publicRoute(
      async () => {
        throw new AuthError(429, 'rate_limited', 120);
      },
      { reason: 'prueba' },
    );
    const response = await route(request('GET'));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
  });

  it('publicRoute exige un motivo', () => {
    expect(() => publicRoute(async () => new Response(), { reason: ' ' })).toThrow('reason');
  });
});
