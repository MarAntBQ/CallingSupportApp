import { z } from 'zod';

export const telegramConfigSchema = z.strictObject({
  botToken: z.string().trim().min(20).max(100),
  botUsername: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ''))
    .pipe(z.string().min(3).max(64).regex(/^[A-Za-z0-9_]+$/)),
});

export type TelegramConfigInput = z.infer<typeof telegramConfigSchema>;
