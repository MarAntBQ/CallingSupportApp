import 'server-only';
import { AuthError, errorResponse } from '@/server/auth/errors';
import { requireSessionFromRequest } from '@/server/auth/session';
import { assertGlobalAdmin, type Session } from '@/server/auth/sessions';
import { isSameOrigin } from './http';

export type Permission = 'global-admin';

type RouteContext<P> = { params?: Promise<P> };

type AuthedHandler<P> = (request: Request, context: { session: Session; params: P }) => Promise<Response>;
type PublicHandler<P> = (request: Request, context: { params: P }) => Promise<Response>;

async function readParams<P>(context?: RouteContext<P>) {
  return ((await context?.params) ?? {}) as P;
}

export function withAuth<P = Record<string, never>>(
  handler: AuthedHandler<P>,
  options: { permission?: Permission } = {},
) {
  return async (request: Request, context?: RouteContext<P>) => {
    try {
      if (!isSameOrigin(request)) throw new AuthError(403, 'bad_origin');
      const session = await requireSessionFromRequest(request);
      if (options.permission === 'global-admin') assertGlobalAdmin(session);
      return await handler(request, { session, params: await readParams(context) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function publicRoute<P = Record<string, never>>(handler: PublicHandler<P>, options: { reason: string }) {
  if (!options.reason?.trim()) throw new Error('publicRoute exige un motivo (reason).');
  return async (request: Request, context?: RouteContext<P>) => {
    try {
      if (!isSameOrigin(request)) throw new AuthError(403, 'bad_origin');
      return await handler(request, { params: await readParams(context) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
