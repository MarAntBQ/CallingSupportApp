export const SITE_TIME_ZONE = 'America/Guayaquil';

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function siteDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`fecha inválida: ${value}`);
  return DAY.format(date);
}
