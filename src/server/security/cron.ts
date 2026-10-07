import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { AuthError } from '@/server/auth/errors';

export function assertCronRequest(request: Request, env: Record<string, string | undefined> = process.env) {
  const secret = env.CRON_SECRET?.trim();
  const header = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  const received = Buffer.from(header);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AuthError(401, 'unauthenticated');
  }
}
