import { NextResponse } from 'next/server';
import { toMe } from '@/server/auth/sessions';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { session }) => NextResponse.json(toMe(session)));
