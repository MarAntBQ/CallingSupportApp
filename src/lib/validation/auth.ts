import { z } from 'zod';

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

export const setupSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  bishopApproved: z.literal(true),
  bishopApprovedBy: z.string().trim().min(2).max(150),
  bishopApprovedOn: z.iso.date().refine((value) => value <= todayPlusOne(), { message: 'future_date' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
