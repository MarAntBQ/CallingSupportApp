import { z } from 'zod';
import { GENDERS, ORDINANCES } from '@/lib/temple-trips/constants';

// Permite hasta mañana por diferencias de zona horaria, pero rechaza fechas claramente futuras.
const notFuture = (value: string) => value <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const participant = z.strictObject({
  idNumber: z.string().trim().min(3).max(40),
  birthDate: z.iso.date().refine(notFuture, { message: 'future_date' }),
  fullName: z.string().trim().min(3).max(150),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  gender: z.enum(GENDERS),
  wantsTransport: z.boolean(),
  needsLodging: z.boolean(),
  wantsBreakfast: z.boolean(),
  wantsLunch: z.boolean(),
  ordinances: z.array(z.enum(ORDINANCES)).max(ORDINANCES.length),
});

export const registrationSchema = z.strictObject({
  participants: z.array(participant).min(1).max(20),
  consent: z.literal(true),
  recaptchaToken: z.string().optional(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type ParticipantInput = z.infer<typeof participant>;
