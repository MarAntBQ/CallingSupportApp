import 'server-only';
import { randomInt } from 'node:crypto';

// Contraseña temporal del restablecimiento (#16): 14 caracteres del alfabeto A-Z a-z 2-9 !@#$%
// sin caracteres ambiguos (0 O 1 l I), para dictarla o entregarla en persona sin confusiones.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
const LENGTH = 14;

export function generateTempPassword(): string {
  let password = '';
  for (let index = 0; index < LENGTH; index += 1) {
    password += ALPHABET[randomInt(ALPHABET.length)];
  }
  return password;
}
