import { z } from 'zod';

export const SMTP_DEFAULT_PORT = 587;

export const smtpSchema = z.strictObject({
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$|^[0-9a-fA-F:.]+$/),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(500).optional(),
});

export const smtpTestSchema = z.strictObject({
  to: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});

export type SmtpInput = z.infer<typeof smtpSchema>;

export type SmtpSummary = { host: string | null; port: number | null; secure: boolean; user: string | null; hasPassword: boolean };
