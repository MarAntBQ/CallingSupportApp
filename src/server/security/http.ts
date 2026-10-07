import 'server-only';
import { createHmac } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedHosts(request: Request) {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(request.url).host);
  } catch {}
  for (const name of ['host', 'x-forwarded-host']) {
    const value = request.headers.get(name);
    if (value) hosts.add(value.split(',')[0]!.trim());
  }
  return hosts;
}

export function isSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    return allowedHosts(request).has(new URL(origin).host);
  } catch {
    return false;
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function privateHash(scope: string, value: string) {
  const key = process.env.DATABASE_URL ?? 'callingsupportapp';
  return `${scope}:${createHmac('sha256', key).update(value.trim().toLowerCase()).digest('hex')}`;
}
