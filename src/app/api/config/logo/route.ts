import { NextResponse } from 'next/server';
import { logoSchema } from '@/lib/validation/config';
import { invalidInputResponse } from '@/server/auth/errors';
import { setLogo } from '@/server/config/service';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (request) => {
    const parsed = logoSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    return NextResponse.json(await setLogo(getDb(), parsed.data.logoDataUrl));
  },
  { permission: 'global-admin' },
);
