import { afterEach, describe, expect, it } from 'vitest';
import { appEnv, isSharedTestEnv } from './app-env';

const original = process.env.APP_ENV;
afterEach(() => {
  if (original === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = original;
});

describe('appEnv', () => {
  it('devuelve el ambiente reconocido', () => {
    for (const env of ['development', 'staging', 'demo', 'production'] as const) {
      process.env.APP_ENV = env;
      expect(appEnv()).toBe(env);
    }
  });

  it('cae en development si falta o no se reconoce', () => {
    delete process.env.APP_ENV;
    expect(appEnv()).toBe('development');
    process.env.APP_ENV = 'cualquier-cosa';
    expect(appEnv()).toBe('development');
  });
});

describe('isSharedTestEnv', () => {
  it('solo staging y demo muestran el banner de datos inventados', () => {
    expect(isSharedTestEnv('staging')).toBe(true);
    expect(isSharedTestEnv('demo')).toBe(true);
    expect(isSharedTestEnv('production')).toBe(false);
    expect(isSharedTestEnv('development')).toBe(false);
  });
});
