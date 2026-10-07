import { beforeEach, describe, expect, it, vi } from 'vitest';

const clients: { end: ReturnType<typeof vi.fn> }[] = [];

vi.mock('postgres', () => ({
  default: vi.fn(() => {
    const client = { end: vi.fn(() => Promise.resolve()) };
    clients.push(client);
    return client;
  }),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn((client: unknown) => ({ client })),
}));

const { CLIENT_OPTIONS, STALE_AFTER_MS, getDb } = await import('./index');

describe('cliente de la base', () => {
  beforeEach(() => {
    clients.length = 0;
    delete (globalThis as { callingSupportDb?: unknown }).callingSupportDb;
    process.env.DATABASE_URL = 'postgres://prueba@localhost:5432/csa_test';
  });

  it('usa el pooler en modo transacción sin sentencias preparadas y una conexión por instancia', () => {
    expect(CLIENT_OPTIONS).toMatchObject({ prepare: false, max: 1 });
  });

  it('no encola consultas sobre la conexión (el pooler de Supabase corta la conexión si recibe varias seguidas)', () => {
    expect(CLIENT_OPTIONS.max_pipeline).toBe(1);
    expect(CLIENT_OPTIONS.idle_timeout).toBeLessThanOrEqual(30);
    expect(CLIENT_OPTIONS.connect_timeout).toBeGreaterThan(0);
  });

  it('reusa la misma conexión mientras se sigue usando', () => {
    const first = getDb(1_000);
    expect(getDb(1_000 + STALE_AFTER_MS - 1)).toBe(first);
    expect(getDb(1_000 + 2 * STALE_AFTER_MS - 2)).toBe(first);
    expect(clients).toHaveLength(1);
  });

  it('tras una pausa larga descarta la conexión vieja y abre una nueva', () => {
    const first = getDb(1_000);
    const second = getDb(1_000 + STALE_AFTER_MS);
    expect(second).not.toBe(first);
    expect(clients).toHaveLength(2);
    expect(clients[0]!.end).toHaveBeenCalledWith({ timeout: 5 });
    expect(clients[1]!.end).not.toHaveBeenCalled();
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow('DATABASE_URL no está configurada');
  });
});
