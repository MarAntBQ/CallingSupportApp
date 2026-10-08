import { NextResponse } from 'next/server';
import { isLocale, type Locale } from '@/i18n/config';
import { publicResourcesQuerySchema } from '@/lib/validation/self-reliance';
import { invalidInputResponse } from '@/server/auth/errors';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { clientIp, privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { publicRoute } from '@/server/security/route';
import { listPublicResources } from '@/server/self-reliance/resources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cookieLocale(request: Request): Locale | null {
  const match = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)csa_locale=([^;]+)/);
  return isLocale(match?.[1]) ? (match![1] as Locale) : null;
}

// Sin reCAPTCHA: es una lectura de enlaces públicos, sin formulario ni datos de personas. El
// límite por IP (#28) basta para que nadie la use para cargar la base.
export const GET = publicRoute(
  async (request) => {
    const db = getDb();
    await consume(db, [{ key: privateHash('self-reliance:ip', clientIp(request)), ...LIMITS.publicResourcesPerIp }]);
    const params = new URL(request.url).searchParams;
    const query = publicResourcesQuerySchema.safeParse(Object.fromEntries(params));
    if (!query.success) return invalidInputResponse(query.error);
    const config = await getConfig(db);
    const fallback: Locale = isLocale(config.defaultLocale) ? config.defaultLocale : 'es';
    const locale = query.data.locale ?? cookieLocale(request) ?? fallback;
    return NextResponse.json(await listPublicResources(db, { locale, filterLocale: locale, category: query.data.category }));
  },
  { reason: 'recursos publicados del portal de Autosuficiencia; enlaces públicos, sin datos de personas' },
);
