import { NextResponse } from 'next/server';
import { smtpSchema } from '@/lib/validation/smtp';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import { ENC_KEY_ERROR } from '@/server/crypto/aes';
import { getSmtpSummary, saveSmtp } from '@/server/mail/smtp-config';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth(async () => NextResponse.json(await getSmtpSummary(getDb())), { permission: 'global-admin' });

export const POST = withAuth(
  async (request) => {
    const parsed = smtpSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    try {
      return NextResponse.json(await saveSmtp(getDb(), parsed.data));
    } catch (error) {
      if (error instanceof Error && error.message === ENC_KEY_ERROR) throw new AuthError(500, 'server_misconfigured');
      throw error;
    }
  },
  { permission: 'global-admin' },
);
