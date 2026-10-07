import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';
import { PHONE_PATTERN } from '@/lib/validation/phone';

export const OTP_LENGTH = 6;
export const MAX_OTP_TRIES = 3;
export const RESET_WINDOW_MINUTES = 15;

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const personName = z.string().trim().min(2).max(100);
const code = z.string().trim().regex(/^\d{6}$/);
const password = z.string().min(PASSWORD_MIN_LENGTH).max(200);

export const registerSchema = z.strictObject({
  firstName: personName,
  lastName: personName,
  email,
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(PHONE_PATTERN)
    .transform((value) => value || null)
    .nullable()
    .optional(),
  password,
  privacyConsent: z.literal(true),
  locale: z.enum(LOCALES),
});

export const verifyOtpSchema = z.strictObject({ email, code });
export const forgotPasswordSchema = z.strictObject({ email });
export const verifyResetOtpSchema = z.strictObject({ email, code });
export const resetPasswordSchema = z.strictObject({
  email,
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
