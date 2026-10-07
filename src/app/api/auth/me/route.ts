import { NextResponse } from 'next/server';
import { errorResponse } from '@/server/auth/errors';
import { requireSessionFromRequest } from '@/server/auth/session';
import { toMe } from '@/server/auth/sessions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return NextResponse.json(toMe(await requireSessionFromRequest(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
