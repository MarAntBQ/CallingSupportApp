import { NextResponse } from 'next/server';
import { createCallingSchema } from '@/lib/validation/organizations';
import { getDb } from '@/server/db';
import { createCalling, listCallings } from '@/server/organizations/catalog';
import { catalogResponse, readBody } from '@/server/organizations/http';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await listCallings(getDb())));

export const POST = withAuth(
  async (request) => {
    const body = await readBody(request, createCallingSchema);
    if (!body.ok) return body.response;
    return catalogResponse(await createCalling(getDb(), body.data), 201);
  },
  { permission: { module: 'callings', action: 'create' } },
);
