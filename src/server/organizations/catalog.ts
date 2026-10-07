import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type {
  CallingItem,
  CreateCallingInput,
  CreateOrganizationInput,
  OrganizationItem,
  UpdateCatalogItemInput,
} from '@/lib/validation/organizations';
import type { Database } from '@/server/db';
import { callings, organizations } from '@/server/db/schema';

export type CatalogResult<T> = { ok: true; data: T } | { ok: false; reason: 'name_taken' | 'not_found' | 'organization_missing' | 'organization_inactive' };

function isUniqueViolation(error: unknown) {
  const own = (error as { code?: unknown } | null)?.code;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return own === '23505' || cause === '23505';
}

async function guardUnique<T>(work: () => Promise<CatalogResult<T>>): Promise<CatalogResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'name_taken' };
    throw error;
  }
}

export function listOrganizations(db: Database): Promise<OrganizationItem[]> {
  return db
    .select({ id: organizations.id, name: organizations.name, active: organizations.active })
    .from(organizations)
    .orderBy(asc(organizations.name));
}

export function listCallings(db: Database): Promise<CallingItem[]> {
  return db
    .select({
      id: callings.id,
      organizationId: callings.organizationId,
      organizationName: organizations.name,
      name: callings.name,
      active: callings.active,
    })
    .from(callings)
    .innerJoin(organizations, eq(callings.organizationId, organizations.id))
    .orderBy(asc(organizations.name), asc(callings.name));
}

export async function createOrganization(db: Database, input: CreateOrganizationInput): Promise<CatalogResult<OrganizationItem>> {
  const [row] = await db
    .insert(organizations)
    .values({ name: input.name })
    .onConflictDoNothing()
    .returning({ id: organizations.id, name: organizations.name, active: organizations.active });
  return row ? { ok: true, data: row } : { ok: false, reason: 'name_taken' };
}

export function updateOrganization(db: Database, id: string, input: UpdateCatalogItemInput) {
  return guardUnique<OrganizationItem>(async () => {
    const [row] = await db
      .update(organizations)
      .set(input)
      .where(eq(organizations.id, id))
      .returning({ id: organizations.id, name: organizations.name, active: organizations.active });
    return row ? { ok: true, data: row } : { ok: false, reason: 'not_found' };
  });
}

export function createCalling(db: Database, input: CreateCallingInput): Promise<CatalogResult<CallingItem>> {
  return db.transaction(async (tx) => {
    const [organization] = await tx
      .select({ name: organizations.name, active: organizations.active })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .for('share')
      .limit(1);
    if (!organization) return { ok: false, reason: 'organization_missing' } as const;
    if (!organization.active) return { ok: false, reason: 'organization_inactive' } as const;
    const [row] = await tx
      .insert(callings)
      .values({ organizationId: input.organizationId, name: input.name })
      .onConflictDoNothing()
      .returning({ id: callings.id, organizationId: callings.organizationId, name: callings.name, active: callings.active });
    if (!row) return { ok: false, reason: 'name_taken' } as const;
    return { ok: true, data: { ...row, organizationName: organization.name } } as const;
  });
}

export function updateCalling(db: Database, id: string, input: UpdateCatalogItemInput) {
  return guardUnique<CallingItem>(async () => {
    const [row] = await db
      .update(callings)
      .set(input)
      .from(organizations)
      .where(and(eq(callings.id, id), eq(callings.organizationId, organizations.id)))
      .returning({
        id: callings.id,
        organizationId: callings.organizationId,
        organizationName: organizations.name,
        name: callings.name,
        active: callings.active,
      });
    return row ? { ok: true, data: row } : { ok: false, reason: 'not_found' };
  });
}
