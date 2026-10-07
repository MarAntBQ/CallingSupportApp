import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export const POOL_OPTIONS = {
  max: 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
} satisfies PoolConfig;

const globalForDb = globalThis as unknown as { callingSupportDb?: Database };

export function getDb(): Database {
  if (globalForDb.callingSupportDb) return globalForDb.callingSupportDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada');
  }
  const pool = new Pool({ connectionString, ...POOL_OPTIONS });
  attachDatabasePool(pool);
  const db = drizzle(pool, { schema });
  globalForDb.callingSupportDb = db;
  return db;
}
