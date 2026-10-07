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

// Edición desde el panel (#21): todos los campos opcionales.
export const participantPatchSchema = z.strictObject({
  idNumber: z.string().trim().min(3).max(40).optional(),
  birthDate: z.iso.date().refine(notFuture, { message: 'future_date' }).optional(),
  fullName: z.string().trim().min(3).max(150).optional(),
  phone: z.string().trim().min(6).max(40).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  gender: z.enum(GENDERS).optional(),
  wantsTransport: z.boolean().optional(),
  needsLodging: z.boolean().optional(),
  wantsBreakfast: z.boolean().optional(),
  wantsLunch: z.boolean().optional(),
  ordinances: z.array(z.enum(ORDINANCES)).max(ORDINANCES.length).optional(),
});

export type ParticipantPatch = z.infer<typeof participantPatchSchema>;
