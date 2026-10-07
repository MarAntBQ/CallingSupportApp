import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgEnum, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['pending', 'active', 'suspended']);

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  level: integer('level').notNull(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone'),
    passwordHash: text('password_hash').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    callingLabel: text('calling_label'),
    status: userStatus('status').notNull().default('pending'),
    locale: text('locale'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    consentPolicyVersion: text('consent_policy_version'),
    consentLocale: text('consent_locale'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('users_email_lowercase', sql`${table.email} = lower(${table.email})`),
    check('users_locale_valid', sql`${table.locale} is null or ${table.locale} in ('es', 'pt', 'en')`),
    index('users_role_id_idx').on(table.roleId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const installation = pgTable(
  'installation',
  {
    id: smallint('id').primaryKey().default(1),
    unitType: text('unit_type').notNull().default('ward'),
    unitName: text('unit_name').notNull().default(''),
    bishopApprovedBy: text('bishop_approved_by').notNull(),
    bishopApprovedOn: date('bishop_approved_on').notNull(),
    setupCompletedAt: timestamp('setup_completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('installation_single_row', sql`${table.id} = 1`),
    check('installation_unit_type_valid', sql`${table.unitType} in ('ward', 'branch')`),
  ],
);
