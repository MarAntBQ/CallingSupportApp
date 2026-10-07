import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_LENGTH } from '@/lib/validation/registration';

export function generateOtpCode() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export function hashOtp(userId: string, code: string) {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

export function otpMatches(userId: string, code: string, storedHash: string | null) {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, 'hex');
  const received = Buffer.from(hashOtp(userId, code), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function generateResetToken() {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function resetTokenMatches(token: string, storedHash: string | null) {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, 'hex');
  const received = Buffer.from(hashResetToken(token), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
