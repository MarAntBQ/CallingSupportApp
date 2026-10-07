import { z } from 'zod';
import { ROOM_ROLES } from '@/lib/temple-trips/constants';

export const createRoomSchema = z.strictObject({
  number: z.string().trim().min(1).max(20),
});

export const assignRoomSchema = z.strictObject({
  roomId: z.uuid().nullable(),
  role: z.enum(ROOM_ROLES).optional(),
});

export const housingDataSchema = z
  .strictObject({
    lastNames: z.string().trim().max(150).optional(),
    firstNames: z.string().trim().max(150).optional(),
    nationality: z.string().trim().max(60).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type AssignRoomInput = z.infer<typeof assignRoomSchema>;
export type HousingDataInput = z.infer<typeof housingDataSchema>;
