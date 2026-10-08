import { NextResponse } from 'next/server';
import { mfaPolicySchema } from '@/lib/validation/mfa';
import { invalidInputResponse } from '@/server/auth/errors';
import { setMfaPolicy } from '@/server/auth/mfa';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(
  async (request) => {
    const parsed = mfaPolicySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    return NextResponse.json(await setMfaPolicy(getDb(), parsed.data.requireMfaForLeaders));
  },
  { permission: 'global-admin' },
);
