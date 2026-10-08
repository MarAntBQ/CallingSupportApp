// URL pública canónica para armar enlaces que salen por correo (p. ej. el enlace personal del
// campamento). Sale de la configuración —APP_URL o, si no está, la primera de APP_ORIGINS—,
// nunca del encabezado Host de la petición: detrás de un proxy puede ser un host interno, y quien
// manda la petición podría poner un dominio ajeno en el correo. En producción exige https.
export function canonicalBaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const configured = env.APP_URL?.trim() || (env.APP_ORIGINS ?? '').split(',').map((origin) => origin.trim()).find(Boolean);
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && env.NODE_ENV === 'production') return null;
    return url.origin;
  } catch {
    return null;
  }
}
