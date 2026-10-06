import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();

vi.mock('@/server/db', () => ({
  getDb: () => ({ execute }),
}));

const { GET } = await import('./route');

describe('GET /api/health', () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it('responde 200 con la base disponible', async () => {
    execute.mockResolvedValue([{ '?column?': 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it('responde 503 sin exponer el error si la base no responde', async () => {
    execute.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432 password=secreta'));
    const res = await GET();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, db: false });
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('secreta');
  });
});
