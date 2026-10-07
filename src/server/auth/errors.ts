import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'bad_origin'
  | 'rate_limited'
  | 'invalid_credentials'
  | 'account_pending'
  | 'account_suspended'
  | 'invalid_input'
  | 'not_found';

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: AuthErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}

export function rateLimited(retryAfterSeconds: number) {
  return new AuthError(429, 'rate_limited', Math.max(1, Math.ceil(retryAfterSeconds)));
}

function errorCode(error: unknown) {
  const own = (error as { code?: unknown } | null)?.code;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof own === 'string' ? own : typeof cause === 'string' ? cause : undefined;
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    const headers = error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : undefined;
    return NextResponse.json({ error: error.code }, { status: error.status, headers });
  }
  const id = randomUUID();
  console.error(JSON.stringify({ event: 'internal_error', id, name: (error as Error | null)?.name, code: errorCode(error) }));
  return NextResponse.json({ error: 'internal_error', id }, { status: 500 });
}
