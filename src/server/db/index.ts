import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

export const CLIENT_OPTIONS = {
  prepare: false,
  max: 1,
  max_pipeline: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
};

export const STALE_AFTER_MS = 15_000;

type Holder = { db: Database; client: postgres.Sql; lastUsedAt: number };

const globalForDb = globalThis as unknown as { callingSupportDb?: Holder };

export function getDb(now = Date.now()): Database {
  const holder = globalForDb.callingSupportDb;
  if (holder && now - holder.lastUsedAt < STALE_AFTER_MS) {
    holder.lastUsedAt = now;
    return holder.db;
  }
  if (holder) {
    holder.client.end({ timeout: 5 }).catch(() => undefined);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está configurada');
  }
  const client = postgres(url, CLIENT_OPTIONS as postgres.Options<Record<string, never>>);
  const db = drizzle(client, { schema });
  globalForDb.callingSupportDb = { db, client, lastUsedAt: now };
  return db;
}
