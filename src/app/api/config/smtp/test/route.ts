import { NextResponse } from 'next/server';
import { smtpTestSchema } from '@/lib/validation/smtp';
import { invalidInputResponse } from '@/server/auth/errors';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { escapeHtml } from '@/server/mail/template';
import { emailTranslator, sendMail, TEST_TIMEOUT_MS } from '@/server/mail/service';
import { privateHash } from '@/server/security/http';
import { consume, LIMITS } from '@/server/security/rate-limit';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(
  async (request, { session }) => {
    const parsed = smtpTestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const db = getDb();
    await consume(db, [{ key: privateHash('smtp-test:user', session.user.id), ...LIMITS.smtpTestPerUser }]);
    const locale = session.user.locale ?? (await getConfig(db)).defaultLocale;
    const unitName = (await getConfig(db)).unitName || 'CallingSupportApp';
    const t = emailTranslator(locale);
    const result = await sendMail(
      'smtp-test',
      {
        to: parsed.data.to,
        subject: t('test.subject'),
        preheader: t('test.preheader'),
        html: `<p>${escapeHtml(t('test.body', { unitName }))}</p>`,
        text: t('test.body', { unitName }),
        locale,
      },
      { db, timeoutMs: TEST_TIMEOUT_MS },
    );
    if (!result.sent) return NextResponse.json({ error: 'smtp_failed', message: result.error ?? '' }, { status: 400 });
    return NextResponse.json({ sent: true });
  },
  { permission: 'global-admin' },
);
