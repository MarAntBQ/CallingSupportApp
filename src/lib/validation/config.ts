import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { containsOfficialChurchName } from '@/lib/church-name';

export const DEFAULT_TIMEZONE = 'America/Guayaquil';

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const LOGO_MAX_DATA_URL_LENGTH = 3_000_000;

export const LOGO_DATA_URL = /^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

export function canonicalTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function timeZoneOptions(): string[] {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [DEFAULT_TIMEZONE];
  return [...zones.filter((zone) => zone.startsWith('America/')), 'UTC'];
}

export const installationContact = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .refine((value) => !containsOfficialChurchName(value), { message: 'official_name' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

export const configSchema = z.strictObject({
  unitName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .refine((value) => !containsOfficialChurchName(value), { message: 'official_name' }),
  allowRegistration: z.boolean(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .transform((value, ctx) => {
      const zone = canonicalTimeZone(value);
      if (!zone) {
        ctx.addIssue({ code: 'custom', message: 'invalid_timezone' });
        return z.NEVER;
      }
      return zone;
    }),
  defaultLocale: z.enum(LOCALES),
  contact: installationContact,
  controller: z.strictObject({
    name: optionalText(150),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => value || null)
      .pipe(z.email().max(254).nullable())
      .nullable(),
    city: optionalText(150),
    website: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(z.url({ protocol: /^https?$/ }).max(300).nullable())
      .nullable(),
  }),
  retentionMonths: z.number().int().min(1).max(120),
  policyVersion: z.string().trim().min(1).max(40),
});

export const logoSchema = z
  .strictObject({
    logoDataUrl: z.string().max(LOGO_MAX_DATA_URL_LENGTH).regex(LOGO_DATA_URL).nullable(),
    notOfficialLogo: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.logoDataUrl !== null && value.notOfficialLogo !== true) {
      ctx.addIssue({ code: 'custom', path: ['notOfficialLogo'], message: 'required' });
    }
  });

export type ConfigInput = z.infer<typeof configSchema>;
export type LogoInput = z.infer<typeof logoSchema>;

export type PublicConfig = {
  unitName: string;
  allowRegistration: boolean;
  logoDataUrl: string | null;
  timezone: string;
  defaultLocale: (typeof LOCALES)[number];
  contact: string | null;
  controller: { name: string | null; email: string | null; city: string | null; website: string | null };
  retentionMonths: number;
  policyVersion: string;
};

export function unitInitials(name: string) {
  const words = name
    .normalize('NFC')
    .split(/[\s-]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  return letters
    .map((word) => [...word][0]!)
    .join('')
    .toLocaleUpperCase();
}
