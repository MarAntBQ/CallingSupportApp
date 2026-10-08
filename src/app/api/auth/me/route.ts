import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { meOf } from '@/server/permissions/service';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { session }) => NextResponse.json(await meOf(getDb(), session)), { mfaExempt: true });
