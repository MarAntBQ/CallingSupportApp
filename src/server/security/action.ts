import 'server-only';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { getSession } from '@/server/auth/session';
import { assertGlobalAdmin, type Session } from '@/server/auth/sessions';
import type { Permission } from './route';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: string[]; id?: string };

export function authedAction<S extends z.ZodType, T>(
  schema: S,
  options: { permission?: Permission },
  action: (input: z.infer<S>, context: { session: Session }) => Promise<T>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    try {
      const session = await getSession();
      if (!session) throw new AuthError(401, 'unauthenticated');
      if (options.permission === 'global-admin') assertGlobalAdmin(session);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')))].filter(Boolean);
        return { ok: false, error: 'invalid_input', fields };
      }
      return { ok: true, data: await action(parsed.data, { session }) };
    } catch (error) {
      if (error instanceof AuthError) return { ok: false, error: error.code };
      const id = randomUUID();
      console.error(JSON.stringify({ event: 'internal_error', id, name: (error as Error | null)?.name }));
      return { ok: false, error: 'internal_error', id };
    }
  };
}
