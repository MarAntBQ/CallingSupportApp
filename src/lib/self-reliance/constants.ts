export const RESOURCE_CATEGORIES = [
  'courses',
  'employment',
  'education',
  'personal_finances',
  'business',
  'emotional_resilience',
  'languages',
  'life_skills',
  'other',
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const RESOURCE_LOCALES = ['all', 'es', 'pt', 'en'] as const;

export type ResourceLocale = (typeof RESOURCE_LOCALES)[number];

export const RESOURCE_TITLE_MAX = 120;
export const RESOURCE_DESCRIPTION_MAX = 400;
export const RESOURCE_URL_MAX = 2048;

// Un recurso es "Oficial de la Iglesia" cuando su dominio (o un subdominio) está aquí. No se
// guarda: se calcula de la URL, así nadie puede marcar como oficial un sitio que no lo es.
export const OFFICIAL_DOMAINS = ['churchofjesuschrist.org', 'englishconnect.org', 'byupathway.org'] as const;

const CHURCH_DOMAIN = 'churchofjesuschrist.org';

const CHURCH_LANG = { es: 'spa', pt: 'por', en: 'eng' } as const;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const isDomainOrSubdomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function isOfficialUrl(url: string) {
  const host = hostOf(url);
  return host !== null && OFFICIAL_DOMAINS.some((domain) => isDomainOrSubdomain(host, domain));
}

// En los enlaces a churchofjesuschrist.org se fija `lang` según el idioma activo, para que la
// persona llegue a la página en su idioma. Los demás dominios quedan como están.
export function withChurchLang(url: string, locale: string) {
  const host = hostOf(url);
  const lang = CHURCH_LANG[locale as keyof typeof CHURCH_LANG];
  if (!host || !lang || !isDomainOrSubdomain(host, CHURCH_DOMAIN)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('lang', lang);
  return parsed.toString();
}
