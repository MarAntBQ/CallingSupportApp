import { z } from 'zod';

export const CATALOG_NAME_MIN = 2;
export const CATALOG_NAME_MAX = 80;

const catalogName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(CATALOG_NAME_MIN).max(CATALOG_NAME_MAX));

export const catalogIdSchema = z.uuid();

export const createOrganizationSchema = z.strictObject({ name: catalogName });

export const updateCatalogItemSchema = z
  .strictObject({ name: catalogName.optional(), active: z.boolean().optional() })
  .refine((value) => value.name !== undefined || value.active !== undefined, { message: 'empty' });

export const createCallingSchema = z.strictObject({ organizationId: z.uuid(), name: catalogName });

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export type CreateCallingInput = z.infer<typeof createCallingSchema>;

export type OrganizationItem = { id: string; name: string; active: boolean };
export type CallingItem = { id: string; organizationId: string; organizationName: string; name: string; active: boolean };
