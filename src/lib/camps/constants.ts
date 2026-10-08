import { GENDERS, type Gender } from '@/lib/temple-trips/constants';

export { GENDERS, type Gender };

export const PARTICIPANT_TYPES = ['youth', 'leader'] as const;
export type ParticipantType = (typeof PARTICIPANT_TYPES)[number];

export const PACKING_APPLIES_TO = ['all', 'youth', 'leader'] as const;
export type PackingAppliesTo = (typeof PACKING_APPLIES_TO)[number];

export const CAMP_NAME_MAX = 120;
export const CAMP_DESCRIPTION_MAX = 2000;
export const CAMP_LOCATION_MAX = 160;
export const CAMP_SLUG_MAX = 60;
export const DONATION_CATEGORY_MAX = 80;
export const DONATION_INSTRUCTIONS_MAX = 600;

// Manual General 20.7.1: «Deben estar presentes por lo menos dos adultos».
export const MIN_ADULT_LEADERS = 2;

// Slug del enlace público /camps/<slug>: minúsculas, sin acentos, solo letras, números y guiones.
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CAMP_SLUG_MAX)
    .replace(/-+$/g, '');
  return slug || 'camp';
}

// `me` es la ruta del enlace personal (/camps/me/<token>): ningún campamento puede usarlo.
const RESERVED_SLUGS = new Set(['me']);

// Siguiente slug libre: "campamento", "campamento-2", "campamento-3"…
export function nextFreeSlug(base: string, taken: ReadonlySet<string>): string {
  const isTaken = (slug: string) => taken.has(slug) || RESERVED_SLUGS.has(slug);
  if (!isTaken(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, CAMP_SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
}
