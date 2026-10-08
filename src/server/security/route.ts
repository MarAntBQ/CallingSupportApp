import 'server-only';
import { AuthError, errorResponse } from '@/server/auth/errors';
import { requireSessionFromRequest } from '@/server/auth/session';
import { assertMfaSatisfied } from '@/server/auth/mfa';
import type { Session } from '@/server/auth/sessions';
import { getDb } from '@/server/db';
import { isSameOrigin } from './http';
import { assertPermission, type Permission } from './permission';

export type { Permission } from './permission';

type RouteContext<P> = { params?: Promise<P> };

type AuthedHandler<P> = (request: Request, context: { session: Session; params: P }) => Promise<Response>;
type PublicHandler<P> = (request: Request, context: { params: P }) => Promise<Response>;

async function readParams<P>(context?: RouteContext<P>) {
  return ((await context?.params) ?? {}) as P;
}

export function withAuth<P = Record<string, never>>(
  handler: AuthedHandler<P>,
  // mfaExempt: solo para lo que se necesita ANTES de activar la verificación obligatoria (#36):
  // quién soy, cerrar sesión y activarla. Todo lo demás exige tenerla activa si es obligatoria.
  options: { permission?: Permission; mfaExempt?: boolean } = {},
) {
  return async (request: Request, context?: RouteContext<P>) => {
    try {
      if (!isSameOrigin(request)) throw new AuthError(403, 'bad_origin');
      const session = await requireSessionFromRequest(request);
      if (!options.mfaExempt) await assertMfaSatisfied(getDb(), session);
      await assertPermission(session, options.permission);
      return await handler(request, { session, params: await readParams(context) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function publicRoute<P = Record<string, never>>(handler: PublicHandler<P>, options: { reason: string; allowCrossOrigin?: boolean }) {
  if (!options.reason?.trim()) throw new Error('publicRoute exige un motivo (reason).');
  return async (request: Request, context?: RouteContext<P>) => {
    try {
      // allowCrossOrigin: solo para webhooks servidor-a-servidor (p. ej. Telegram), que se
      // autentican con un secreto propio y NO envían Origin. El handler DEBE validar ese secreto.
      if (!options.allowCrossOrigin && !isSameOrigin(request)) throw new AuthError(403, 'bad_origin');
      return await handler(request, { params: await readParams(context) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
