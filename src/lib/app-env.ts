export const APP_ENVS = ['development', 'staging', 'demo', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

// Ambiente lógico de la aplicación, independiente de NODE_ENV. Controla el banner de pruebas
// y el robots.txt. Se lee de APP_ENV; cualquier valor no reconocido cae en 'development'.
export function appEnv(): AppEnv {
  const value = process.env.APP_ENV ?? '';
  return (APP_ENVS as readonly string[]).includes(value) ? (value as AppEnv) : 'development';
}

// Los ambientes compartidos (staging y demo) muestran el banner de "datos inventados".
export function isSharedTestEnv(env: AppEnv = appEnv()): boolean {
  return env === 'staging' || env === 'demo';
}
