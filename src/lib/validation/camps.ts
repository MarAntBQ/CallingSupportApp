import { z } from 'zod';
import {
  CAMP_DESCRIPTION_MAX,
  GENDERS,
  CAMP_LOCATION_MAX,
  CAMP_NAME_MAX,
  DONATION_CATEGORY_MAX,
  DONATION_INSTRUCTIONS_MAX,
} from '@/lib/camps/constants';

const quota = z.number().int().min(0);

const fee = z
  .number()
  .min(0)
  .transform((value) => (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => value?.trim() || null);

export const campSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(CAMP_NAME_MAX),
    description: optionalText(CAMP_DESCRIPTION_MAX),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    location: z.string().trim().min(2).max(CAMP_LOCATION_MAX),
    registrationDeadline: z.iso.date(),
    feeYouth: fee,
    feeLeader: fee,
    // Manual General 20.6.2: solo se pide un aporte si el obispado lo autorizó porque el
    // presupuesto no alcanza. Es la casilla que confirma quien crea o edita el campamento.
    feeAuthorized: z.boolean(),
    donationCategoryName: optionalText(DONATION_CATEGORY_MAX),
    donationInstructions: optionalText(DONATION_INSTRUCTIONS_MAX),
    quotaYouthMale: quota,
    quotaYouthFemale: quota,
    open: z.boolean(),
  })
  .refine((data) => data.endDate >= data.startDate, { message: 'end_before_start', path: ['endDate'] })
  .refine((data) => data.registrationDeadline <= data.endDate, { message: 'deadline_after_end', path: ['registrationDeadline'] })
  .refine((data) => data.feeAuthorized || (Number(data.feeYouth) === 0 && Number(data.feeLeader) === 0), {
    message: 'fee_authorization_required',
    path: ['feeAuthorized'],
  });

export type CampInput = z.infer<typeof campSchema>;

export type CampItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string;
  registrationDeadline: string;
  feeYouth: string;
  feeLeader: string;
  feeAuthorized: boolean;
  feeAuthorizedAt: string | null;
  feeAuthorizedByName: string | null;
  donationCategoryName: string | null;
  donationInstructions: string | null;
  quotaYouthMale: number;
  quotaYouthFemale: number;
  open: boolean;
  youthCount: number;
  leaderCount: number;
  approvedCount: number;
  pendingCount: number;
  createdAt: string;
  updatedAt: string;
};

// Permite hasta mañana por diferencias de zona horaria, pero rechaza fechas claramente futuras.
const notFuture = (value: string) => value <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const phone = z.string().trim().min(6).max(40);
const personName = z.string().trim().min(3).max(150);

// Solo lo que el campamento necesita (Manual General 33.8). Sin datos médicos: van en el
// formulario oficial «Permiso y autorización para dar atención médica» (20.7.4).
const youth = z.strictObject({
  fullName: z.string().trim().min(3).max(160),
  birthDate: z.iso.date().refine(notFuture, { message: 'future_date' }),
  gender: z.enum(GENDERS),
  emergencyContactName: personName,
  emergencyContactPhone: phone,
});

export const campRegistrationSchema = z.strictObject({
  guardian: z.strictObject({
    name: personName,
    phone,
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  }),
  participants: z.array(youth).min(1).max(10),
  consent: z.literal(true),
  recaptchaToken: z.string().optional(),
});

export type CampRegistrationInput = z.infer<typeof campRegistrationSchema>;

export type PublicCampView = {
  slug: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string;
  registrationDeadline: string;
  registrationOpen: boolean;
  suggestedContributionYouth: string | null;
  donationCategoryName: string | null;
  donationInstructions: string | null;
  packing: { id: string; name: string; detail: string | null; category: string }[];
};

export type PersonalLinkView = {
  camp: { name: string; startDate: string; endDate: string; location: string };
  participant: { fullName: string; type: 'youth' | 'leader'; approved: boolean };
};
