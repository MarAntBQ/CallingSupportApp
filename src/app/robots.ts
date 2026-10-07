import type { MetadataRoute } from 'next';
import { appEnv } from '@/lib/app-env';

// En staging/demo/desarrollo se bloquea todo rastreo; solo producción permite el index.
// (El layout además marca noindex a nivel de metadatos.)
export default function robots(): MetadataRoute.Robots {
  const production = appEnv() === 'production';
  return {
    rules: production ? { userAgent: '*', allow: '/' } : { userAgent: '*', disallow: '/' },
  };
}
