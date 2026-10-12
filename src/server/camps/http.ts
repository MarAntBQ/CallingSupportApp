import 'server-only';
import { z } from 'zod';
import { canonicalBaseUrl } from '@/lib/public-url';
import { AuthError } from '@/server/auth/errors';

export function parseId(value: string) {
  const id = z.uuid().safeParse(value);
  if (!id.success) throw new AuthError(404, 'not_found');
  return id.data;
}

// Base de los enlaces del correo: la URL configurada (APP_URL o APP_ORIGINS). Solo fuera de
// producción (desarrollo y pruebas) se acepta el origin de la petición, nunca el Host en producción.
export function linkBaseUrl(request: Request) {
  return canonicalBaseUrl() ?? (process.env.NODE_ENV === 'production' ? null : new URL(request.url).origin);
}
