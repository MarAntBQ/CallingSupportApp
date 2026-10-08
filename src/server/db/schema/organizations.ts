import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('organizations_name_unique').on(sql`lower(${table.name})`),
    check('organizations_name_length', sql`char_length(${table.name}) between 2 and 80`),
  ],
);

export const callings = pgTable(
  'callings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('callings_organization_name_unique').on(table.organizationId, sql`lower(${table.name})`),
    check('callings_name_length', sql`char_length(${table.name}) between 2 and 80`),
  ],
);

export const userCallings = pgTable(
  'user_callings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    callingId: uuid('calling_id')
      .notNull()
      .references(() => callings.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.callingId] }), index('user_callings_calling_id_idx').on(table.callingId)],
);

export const modulePermissions = pgTable(
  'module_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    module: text('module').notNull(),
    callingId: uuid('calling_id')
      .notNull()
      .references(() => callings.id, { onDelete: 'cascade' }),
    canRead: boolean('can_read').notNull().default(false),
    canCreate: boolean('can_create').notNull().default(false),
    canUpdate: boolean('can_update').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    canNotify: boolean('can_notify').notNull().default(false),
  },
  (table) => [
    uniqueIndex('module_permissions_module_calling_unique').on(table.module, table.callingId),
    index('module_permissions_calling_id_idx').on(table.callingId),
    check('module_permissions_module_valid', sql`${table.module} in ('temple-trips', 'users', 'callings', 'permissions', 'self-reliance')`),
  ],
);
