import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { pageExtensionsFor } from './src/lib/dev-pages';
import { API_CSP, STATIC_SECURITY_HEADERS } from './src/lib/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
