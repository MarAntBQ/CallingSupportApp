import { beforeEach, describe, expect, it, vi } from 'vitest';

const pools: { config: Record<string, unknown> }[] = [];
const attachDatabasePool = vi.fn();

vi.mock('pg', () => ({
  Pool: vi.fn(function Pool(this: { config: Record<string, unknown> }, config: Record<string, unknown>) {
    this.config = config;
    pools.push(this);
  }),
}));

vi.mock('@vercel/functions', () => ({ attachDatabasePool }));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn((pool: unknown) => ({ pool })),
}));

const { POOL_OPTIONS, getDb } = await import('./index');

describe('cliente de la base', () => {
  beforeEach(() => {
    pools.length = 0;
    attachDatabasePool.mockClear();
    delete (globalThis as { callingSupportDb?: unknown }).callingSupportDb;
    process.env.DATABASE_URL = 'postgres://prueba@localhost:5432/csa_test';
  });

  it('crea un solo pool por instancia y lo reusa', () => {
    const first = getDb();
    expect(getDb()).toBe(first);
    expect(pools).toHaveLength(1);
    expect(pools[0]!.config).toMatchObject({ connectionString: process.env.DATABASE_URL, ...POOL_OPTIONS });
  });

  it('entrega el pool a Vercel para que libere las conexiones antes de pausar la función', () => {
    getDb();
    expect(attachDatabasePool).toHaveBeenCalledWith(pools[0]);
  });

  it('cierra rápido las conexiones inactivas y no espera para siempre al conectar', () => {
    expect(POOL_OPTIONS.idleTimeoutMillis).toBeLessThanOrEqual(10_000);
    expect(POOL_OPTIONS.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(POOL_OPTIONS.max).toBeGreaterThan(1);
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow('DATABASE_URL no está configurada');
  });
});
