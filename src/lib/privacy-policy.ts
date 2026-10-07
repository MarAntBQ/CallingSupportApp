import type { Locale } from '@/i18n/config';

export const POLICY_SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's15', 's16', 's17'] as const;

export const CHURCH_URL: Record<Locale, string> = {
  es: 'https://www.churchofjesuschrist.org/?lang=spa',
  pt: 'https://www.churchofjesuschrist.org/?lang=por',
  en: 'https://www.churchofjesuschrist.org/?lang=eng',
};

export const ONLINE_RESOURCES_HANDBOOK_URL: Record<Locale, string> = {
  es: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/38-church-policies-and-guidelines?lang=spa#title_number158',
  pt: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/38-church-policies-and-guidelines?lang=por#title_number158',
  en: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/38-church-policies-and-guidelines?lang=eng#title_number158',
};

export const PROJECT_REPOSITORY_URL = 'https://github.com/MarAntBQ/CallingSupportApp';

export function recaptchaEnabled(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.RECAPTCHA_SECRET_KEY?.trim());
}

export function controllerConfigured(controller: { name: string | null; email: string | null }) {
  return Boolean(controller.name && controller.email);
}
