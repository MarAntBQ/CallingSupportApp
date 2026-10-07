import { NextResponse } from 'next/server';
import { profileSchema } from '@/lib/validation/profile';
import { invalidInputResponse } from '@/server/auth/errors';
import { updateProfile } from '@/server/auth/profile';
import { getSessionFromRequest } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { meOf } from '@/server/permissions/service';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(async (request, { session }) => {
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInputResponse(parsed.error);
  await updateProfile(getDb(), session.user.id, parsed.data);
  const updated = await getSessionFromRequest(request);
  return NextResponse.json(await meOf(getDb(), updated ?? session));
});
