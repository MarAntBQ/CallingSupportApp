import { z } from 'zod';

export const RECOVERY_CODE_COUNT = 10;
// Sin caracteres que se confunden al copiarlos a mano (0/o, 1/l/i).
export const RECOVERY_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function normalizeRecoveryCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export const totpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

export const recoveryCode = z
  .string()
  .transform(normalizeRecoveryCode)
  .pipe(z.string().regex(new RegExp(`^[${RECOVERY_CODE_ALPHABET}]{4}-[${RECOVERY_CODE_ALPHABET}]{4}$`)));

export const mfaEnableSchema = z.object({ code: totpCode });

export const mfaRecoveryCodesSchema = z.object({ code: totpCode });

// Para desactivar: la contraseña actual y un código de la aplicación o uno de recuperación.
export const mfaDisableSchema = z.object({
  password: z.string().min(1).max(200),
  code: z.union([totpCode, recoveryCode]),
});

export const mfaVerifySchema = z
  .object({
    challengeId: z.uuid(),
    code: totpCode.optional(),
    recoveryCode: recoveryCode.optional(),
  })
  .refine((value) => Boolean(value.code) !== Boolean(value.recoveryCode), { message: 'one_factor' });

export type MfaStatusView = { enabled: boolean; required: boolean; recommended: boolean; demo: boolean };

export const mfaPolicySchema = z.strictObject({ requireMfaForLeaders: z.boolean() });
