import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { callingSupportDb?: Database };

export function getDb(): Database {
  if (globalForDb.callingSupportDb) return globalForDb.callingSupportDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está configurada');
  }
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });
  globalForDb.callingSupportDb = db;
  return db;
}
