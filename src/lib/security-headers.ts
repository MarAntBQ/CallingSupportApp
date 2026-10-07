export type CspOptions = { development?: boolean; vercelPreview?: boolean };

export function buildCsp(nonce: string, { development = false, vercelPreview = false }: CspOptions = {}) {
  const vercelLive = vercelPreview ? ' https://vercel.live' : '';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}${vercelLive}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${vercelLive}`,
    "font-src 'self'",
    `connect-src 'self'${vercelLive}`,
    `frame-src ${vercelPreview ? 'https://vercel.live' : "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}

export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

export const STATIC_SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
