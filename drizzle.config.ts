import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DIRECT_DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const url = process.env.DIRECT_DATABASE_URL;
if (!url) {
  throw new Error('Falta DIRECT_DATABASE_URL (copia .env.example a .env).');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
