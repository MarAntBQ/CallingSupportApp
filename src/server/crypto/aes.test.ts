import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, ENC_KEY_ERROR, encrypt, encryptionKey } from './aes';

const KEY_HEX = randomBytes(32).toString('hex');
const key = encryptionKey({ ENC_KEY: KEY_HEX });

describe('cifrado AES-256-GCM', () => {
  it('cifra y descifra, con un IV distinto en cada cifrado', () => {
    const secret = 'contraseña-smtp-ñ';
    const a = encrypt(secret, key);
    const b = encrypt(secret, key);
    expect(a).not.toBe(b);
    expect(a).not.toContain(secret);
    expect(decrypt(a, key)).toBe(secret);
  });

  it('guarda base64(iv[12] | authTag[16] | texto cifrado)', () => {
    const raw = Buffer.from(encrypt('abc', key), 'base64');
    expect(raw.length).toBe(12 + 16 + 3);
  });

  it('falla si el texto cifrado fue alterado o la llave es otra', () => {
    const raw = Buffer.from(encrypt('abc', key), 'base64');
    raw.writeUInt8(raw.at(-1)! ^ 1, raw.length - 1);
    expect(() => decrypt(raw.toString('base64'), key)).toThrow();
    expect(() => decrypt(encrypt('abc', key), encryptionKey({ ENC_KEY: randomBytes(32).toString('hex') }))).toThrow();
    expect(() => decrypt('corto', key)).toThrow('Texto cifrado inválido.');
  });

  it('una ENC_KEY ausente, corta o con caracteres que no son hex da el error exacto', () => {
    for (const value of [undefined, '', 'abc', KEY_HEX.slice(0, 63), `${KEY_HEX.slice(0, 62)}zz`, `${KEY_HEX}00`]) {
      expect(() => encryptionKey({ ENC_KEY: value })).toThrow(ENC_KEY_ERROR);
    }
    expect(encryptionKey({ ENC_KEY: ` ${KEY_HEX.toUpperCase()} ` })).toHaveLength(32);
  });
});
