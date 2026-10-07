import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function isPrivateAddress(address: string) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(ip);
  }
  return false;
}

export function privateHostsAllowed(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== 'production' || env.SMTP_ALLOW_PRIVATE_HOSTS === 'true';
}

export async function assertPublicSmtpHost(
  host: string,
  options: { env?: Record<string, string | undefined>; resolve?: (host: string) => Promise<string[]> } = {},
) {
  if (privateHostsAllowed(options.env)) return;
  const resolve = options.resolve ?? (async (name: string) => (await lookup(name, { all: true })).map((entry) => entry.address));
  const addresses = isIP(host.replace(/^\[|\]$/g, '')) ? [host] : await resolve(host);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new SmtpHostNotAllowedError();
}

export class SmtpHostNotAllowedError extends Error {
  constructor() {
    super('smtp_host_not_allowed');
    this.name = 'SmtpHostNotAllowedError';
  }
}
