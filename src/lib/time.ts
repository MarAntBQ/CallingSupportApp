// 'YYYY-MM-DD' del día de hoy en una zona horaria IANA dada. Se usa para evaluar el plazo de
// inscripción y la retención en la zona de la configuración, no en la del servidor.
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Suma meses a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD' (en UTC, sin horas).
export function addMonths(date: string, months: number): string {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}
