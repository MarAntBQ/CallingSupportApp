import { NextResponse } from 'next/server';
import { configSchema } from '@/lib/validation/config';
import { invalidInputResponse } from '@/server/auth/errors';
import { getConfig, updateConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { publicRoute, withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = publicRoute(async () => NextResponse.json(await getConfig(getDb())), {
  reason: 'el nombre, el logo, el contacto y el responsable de la instalación se muestran antes de iniciar sesión',
});

export const PATCH = withAuth(
  async (request) => {
    const parsed = configSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    return NextResponse.json(await updateConfig(getDb(), parsed.data));
  },
  { permission: 'global-admin' },
);
