import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;

export const ENC_KEY_ERROR = 'ENC_KEY falta o no mide 64 caracteres hexadecimales (genérala con: openssl rand -hex 32).';

export function encryptionKey(env: Record<string, string | undefined> = process.env) {
  const hex = env.ENC_KEY?.trim() ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error(ENC_KEY_ERROR);
  return Buffer.from(hex, 'hex');
}

export function encrypt(plain: string, key: Buffer = encryptionKey()) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decrypt(payload: string, key: Buffer = encryptionKey()) {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error('Texto cifrado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}
