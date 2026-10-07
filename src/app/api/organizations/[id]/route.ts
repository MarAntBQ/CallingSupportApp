import { updateCatalogItemSchema } from '@/lib/validation/organizations';
import { getDb } from '@/server/db';
import { updateOrganization } from '@/server/organizations/catalog';
import { catalogResponse, parseCatalogId, readBody } from '@/server/organizations/http';
import { withAuth } from '@/server/security/route';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ id: string }>(
  async (request, { params }) => {
    const id = parseCatalogId(params.id);
    const body = await readBody(request, updateCatalogItemSchema);
    if (!body.ok) return body.response;
    return catalogResponse(await updateOrganization(getDb(), id, body.data));
  },
  { permission: { module: 'callings', action: 'update' } },
);
