import { NextResponse } from 'next/server';
import { setupSchema } from '@/lib/validation/auth';
import { errorResponse } from '@/server/auth/errors';
import { setSessionCookie } from '@/server/auth/session';
import { createSession, findSession, toMe } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { isSetupNeeded, performSetup } from '@/server/setup/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ needed: await isSetupNeeded(getDb()) });
}

export async function POST(request: Request) {
  const db = getDb();
  if (!(await isSetupNeeded(db))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')))].filter(Boolean);
    return NextResponse.json({ error: 'invalid_input', fields }, { status: 400 });
  }

  try {
    const { userId } = await performSetup(db, parsed.data);
    const { token, expiresAt } = await createSession(db, userId, { userAgent: request.headers.get('user-agent') });
    const session = await findSession(db, token);
    const response = NextResponse.json(toMe(session!), { status: 201 });
    setSessionCookie(response, token, { expiresAt, persistent: false });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
