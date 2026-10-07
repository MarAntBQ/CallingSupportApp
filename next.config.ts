import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { pageExtensionsFor } from './src/lib/dev-pages';
import { API_CSP, STATIC_SECURITY_HEADERS } from './src/lib/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Server autónomo para correr la app bajo pm2 en el VPS (node .next/standalone/server.js).
  // Solo cuando el build del VPS lo pide: `next start` (que usa el e2e) no soporta standalone.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  pageExtensions: pageExtensionsFor(process.env),
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/(.*)', headers: STATIC_SECURITY_HEADERS },
      { source: '/api/(.*)', headers: [{ key: 'Content-Security-Policy', value: API_CSP }] },
    ];
  },
};

export default withNextIntl(nextConfig);
