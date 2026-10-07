import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { catalogIdSchema } from '@/lib/validation/organizations';
import { AuthError, invalidInputResponse } from '@/server/auth/errors';
import type { CatalogResult } from './catalog';

const INVALID = {
  name_taken: ['name', 'taken'],
  organization_missing: ['organizationId', 'not_found'],
  organization_inactive: ['organizationId', 'inactive'],
} as const;

export function parseCatalogId(raw: string | undefined) {
  const parsed = catalogIdSchema.safeParse(raw);
  if (!parsed.success) throw new AuthError(404, 'not_found');
  return parsed.data;
}

export async function readBody<T>(request: Request, schema: ZodType<T>) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  return parsed.success ? ({ ok: true, data: parsed.data } as const) : ({ ok: false, response: invalidInputResponse(parsed.error) } as const);
}

export function catalogResponse<T>(result: CatalogResult<T>, status = 200) {
  if (result.ok) return NextResponse.json(result.data, { status });
  if (result.reason === 'not_found') throw new AuthError(404, 'not_found');
  const [field, code] = INVALID[result.reason];
  return NextResponse.json({ error: 'invalid_input', fields: [field], issues: [{ field, code }] }, { status: 400 });
}
