import 'server-only';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const PRIVATE_V4 = new BlockList();
const PRIVATE_V6 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  PRIVATE_V4.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE_V6.addSubnet(network, prefix, 'ipv6');
}

function bare(address: string) {
  return address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
}

export function isPrivateAddress(address: string) {
  const ip = bare(address);
  const family = isIP(ip);
  if (family === 4) return PRIVATE_V4.check(ip, 'ipv4');
  if (family === 6) return PRIVATE_V4.check(ip, 'ipv6') || PRIVATE_V6.check(ip, 'ipv6');
  return true;
}

export function privateHostsAllowed(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== 'production' || env.SMTP_ALLOW_PRIVATE_HOSTS === 'true';
}

export class SmtpHostNotAllowedError extends Error {
  constructor() {
    super('smtp_host_not_allowed');
    this.name = 'SmtpHostNotAllowedError';
  }
}

export async function resolveSmtpTarget(
  host: string,
  options: { env?: Record<string, string | undefined>; resolve?: (host: string) => Promise<string[]> } = {},
): Promise<{ connectTo: string; servername?: string }> {
  if (privateHostsAllowed(options.env)) return { connectTo: host };
  const literal = bare(host);
  if (isIP(literal)) {
    if (isPrivateAddress(literal)) throw new SmtpHostNotAllowedError();
    return { connectTo: literal };
  }
  const resolve = options.resolve ?? (async (name: string) => (await lookup(name, { all: true })).map((entry) => entry.address));
  const addresses = await resolve(host);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new SmtpHostNotAllowedError();
  return { connectTo: addresses[0]!, servername: host };
}
