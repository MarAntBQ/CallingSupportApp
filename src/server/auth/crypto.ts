import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

let dummyHash: Promise<string> | undefined;

function getDummyHash() {
  dummyHash ??= bcrypt.hash('csa-dummy-password-for-timing', BCRYPT_COST);
  return dummyHash;
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  const ok = await bcrypt.compare(password, hash ?? (await getDummyHash()));
  return ok && Boolean(hash);
}
