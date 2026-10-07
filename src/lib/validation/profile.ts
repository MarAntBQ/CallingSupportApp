import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';
import { PHONE_PATTERN } from '@/lib/validation/phone';

const personName = z.string().trim().min(2).max(100);

export const profileSchema = z
  .strictObject({
    firstName: personName.optional(),
    lastName: personName.optional(),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(PHONE_PATTERN)
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
