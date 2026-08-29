import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM. La llave maestra vive SOLO en .env (ENC_KEY, 64 hex = 32
// bytes), nunca en la base de datos — lo que se guarda en la BD es el
// secreto ya cifrado (ej. el token del bot de Telegram), nunca en texto
// plano. Formato almacenado: base64( iv(12) | authTag(16) | ciphertext ).
function key(): Buffer {
  const hex = process.env.ENC_KEY || '';
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENC_KEY inválida: se requieren 32 bytes (64 hex) en .env');
  }
  return buf;
}

export function encryptToBase64(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptFromBase64(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
