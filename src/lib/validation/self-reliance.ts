import { z } from 'zod';
import {
  RESOURCE_CATEGORIES,
  RESOURCE_DESCRIPTION_MAX,
  RESOURCE_LOCALES,
  RESOURCE_TITLE_MAX,
  RESOURCE_URL_MAX,
  type ResourceCategory,
  type ResourceLocale,
} from '@/lib/self-reliance/constants';

// Solo HTTPS y con un dominio real: un enlace http:// o a una IP/localhost se rechaza con 400.
const httpsUrl = z.string().trim().max(RESOURCE_URL_MAX).pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain }));

export const resourceSchema = z.strictObject({
  title: z.string().trim().min(2).max(RESOURCE_TITLE_MAX),
  description: z
    .string()
    .max(RESOURCE_DESCRIPTION_MAX)
    .optional()
    .transform((value) => value?.trim() || null),
  url: httpsUrl,
  category: z.enum(RESOURCE_CATEGORIES),
  locale: z.enum(RESOURCE_LOCALES),
  published: z.boolean(),
});

export type ResourceInput = z.infer<typeof resourceSchema>;

export const resourceUpdateSchema = resourceSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'empty' });

export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;

// El orden se manda completo: la lista de todos los recursos, en el orden nuevo.
export const reorderSchema = z.strictObject({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'duplicate' }),
});

export type ResourceItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: ResourceCategory;
  locale: ResourceLocale;
  position: number;
  published: boolean;
  official: boolean;
  updatedAt: string;
};

export type PublicResource = Pick<ResourceItem, 'id' | 'title' | 'description' | 'url' | 'category' | 'locale' | 'official'>;

export const publicResourcesQuerySchema = z.strictObject({
  category: z.enum(RESOURCE_CATEGORIES).optional(),
  locale: z.enum(['es', 'pt', 'en']).optional(),
});
