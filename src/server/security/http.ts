import 'server-only';
import { createHmac } from 'node:crypto';
import { ipAddress } from '@vercel/functions';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins(request: Request) {
  const origins = new Set<string>();
  const url = new URL(request.url);
  origins.add(url.origin);
  const host = request.headers.get('host');
  if (host) origins.add(`${url.protocol}//${host}`);
  for (const extra of (process.env.APP_ORIGINS ?? '').split(',')) {
    if (extra.trim()) origins.add(extra.trim().replace(/\/+$/, ''));
  }
  return origins;
}

export function isSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    return allowedOrigins(request).has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function clientIp(request: Request) {
  const fromVercel = ipAddress(request);
  if (fromVercel) return fromVercel;
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function privateHash(scope: string, value: string) {
  const key = process.env.DATABASE_URL ?? 'callingsupportapp';
  return `${scope}:${createHmac('sha256', key).update(value.trim().toLowerCase()).digest('hex')}`;
}
