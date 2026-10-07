import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { containsOfficialChurchName } from '@/lib/church-name';
import { installationContact } from '@/lib/validation/config';

export const PASSWORD_MIN_LENGTH = 8;

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const name = z.string().trim().min(1).max(100);

function todayPlusOne() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional().default(false),
});

export const UNIT_TYPES = ['ward', 'branch'] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

export const setupSchema = z.object({
  unitType: z.enum(UNIT_TYPES),
  unitName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .refine((value) => !containsOfficialChurchName(value), { message: 'official_name' }),
  contact: installationContact,
  firstName: name,
  lastName: name,
  email,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  bishopApproved: z.literal(true),
  bishopApprovedBy: z.string().trim().min(2).max(150),
  bishopApprovedOn: z.iso.date().refine((value) => value <= todayPlusOne(), { message: 'future_date' }),
  privacyConsent: z.literal(true),
  locale: z.enum(LOCALES),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
