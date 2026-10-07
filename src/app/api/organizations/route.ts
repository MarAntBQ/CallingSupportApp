import { NextResponse } from 'next/server';
import { createOrganizationSchema } from '@/lib/validation/organizations';
import { getDb } from '@/server/db';
import { createOrganization, listOrganizations } from '@/server/organizations/catalog';
import { catalogResponse, readBody } from '@/server/organizations/http';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => NextResponse.json(await listOrganizations(getDb())));

export const POST = withAuth(
  async (request) => {
    const body = await readBody(request, createOrganizationSchema);
    if (!body.ok) return body.response;
    return catalogResponse(await createOrganization(getDb(), body.data), 201);
  },
  { permission: { module: 'callings', action: 'create' } },
);
