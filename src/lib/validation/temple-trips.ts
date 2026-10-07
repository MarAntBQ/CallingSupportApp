import { z } from 'zod';
import { QUOTA_KEYS, type QuotaKey, TEMPLE_NAME_MAX } from '@/lib/temple-trips/constants';

const quota = z.number().int().min(0);

const cost = z
  .number()
  .min(0)
  .transform((value) => (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));

const quotaShape = Object.fromEntries(QUOTA_KEYS.map((key) => [key, quota])) as Record<QuotaKey, typeof quota>;

export const templeTripSchema = z
  .strictObject({
    date: z.iso.date(),
    registrationDeadline: z.iso.date(),
    dateConfirmed: z.boolean(),
    includesTransport: z.boolean(),
    includesLodging: z.boolean(),
    includesBreakfast: z.boolean(),
    includesLunch: z.boolean(),
    quotaTransport: quota,
    quotaLodging: quota,
    costTransport: cost,
    costBreakfast: cost,
    costLunch: cost,
    ...quotaShape,
    templeName: z.string().trim().min(2).max(TEMPLE_NAME_MAX),
    inAssignedDistrict: z.boolean(),
    scheduledWithTemple: z.boolean(),
    active: z.boolean(),
  })
  .refine((data) => data.registrationDeadline <= data.date, {
    message: 'deadline_after_date',
    path: ['registrationDeadline'],
  })
  .refine((data) => !(data.active && !data.scheduledWithTemple), {
    message: 'schedule_with_temple_required',
    path: ['scheduledWithTemple'],
  });

export type TempleTripInput = z.infer<typeof templeTripSchema>;
