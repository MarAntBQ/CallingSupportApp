import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');

const resolve = {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
  },
};

export default defineConfig({
  resolve,
  test: {
    environment: 'node',
    projects: [
      {
        resolve,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'site/**/*.test.mjs'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        resolve,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
