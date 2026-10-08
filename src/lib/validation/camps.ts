import { z } from 'zod';
import {
  CAMP_DESCRIPTION_MAX,
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
