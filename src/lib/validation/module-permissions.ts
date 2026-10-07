import { z } from 'zod';
import { MODULES } from '@/lib/modules';

export const PERMISSION_FLAGS = ['canRead', 'canCreate', 'canUpdate', 'canDelete', 'canNotify'] as const;

export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

export const MAX_MATRIX_ROWS = 1000;

export const moduleKeySchema = z.enum(MODULES);

const permissionRow = z.strictObject({
  callingId: z.uuid(),
  canRead: z.boolean(),
  canCreate: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
  canNotify: z.boolean(),
});

export const modulePermissionsSchema = z.strictObject({
  permissions: z
    .array(permissionRow)
    .max(MAX_MATRIX_ROWS)
    .refine((rows) => new Set(rows.map((row) => row.callingId)).size === rows.length, { message: 'duplicate_calling' }),
});

export type ModulePermissionsInput = z.infer<typeof modulePermissionsSchema>;

export type MatrixRow = {
  callingId: string;
  callingName: string;
  organizationName: string;
  active: boolean;
} & Record<PermissionFlag, boolean>;

export type PermissionMatrix = Record<(typeof MODULES)[number], MatrixRow[]>;
