import { NextResponse } from 'next/server';

export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_credentials'
  | 'account_pending'
  | 'account_suspended'
  | 'invalid_input'
  | 'not_found';

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: AuthErrorCode,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  throw error;
}
