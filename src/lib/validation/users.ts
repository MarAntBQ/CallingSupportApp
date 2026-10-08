import { z } from 'zod';

const LOCALES = ['es', 'pt', 'en'] as const;
const USER_STATUS = ['pending', 'active', 'suspended'] as const;

const callingIds = z.array(z.uuid()).max(50);
const callingLabel = z.string().trim().max(80);

export const createUserSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  phone: z.string().trim().max(40).optional(),
  roleId: z.uuid(),
  callingIds: callingIds.optional(),
  callingLabel: callingLabel.optional(),
  locale: z.enum(LOCALES).optional(),
});

export const updateUserSchema = z
  .strictObject({
    roleId: z.uuid().optional(),
    status: z.enum(USER_STATUS).optional(),
    callingIds: callingIds.optional(),
    callingLabel: callingLabel.optional(),
    locale: z.enum(LOCALES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'empty_patch' });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
