import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

// Campamento (#30). La app no maneja dinero (Manual General 20.6 y 34): `fee_*` es solo el aporte
// sugerido, que exige la autorización del obispado, y nunca se registran pagos ni saldos.
export const camps = pgTable(
  'camps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    location: text('location').notNull(),
    registrationDeadline: date('registration_deadline', { mode: 'string' }).notNull(),
    feeYouth: numeric('fee_youth', { precision: 10, scale: 2 }).notNull().default('0'),
    feeLeader: numeric('fee_leader', { precision: 10, scale: 2 }).notNull().default('0'),
    donationCategoryName: text('donation_category_name'),
    donationInstructions: text('donation_instructions'),
    feeAuthorized: boolean('fee_authorized').notNull().default(false),
    feeAuthorizedBy: uuid('fee_authorized_by').references(() => users.id, { onDelete: 'set null' }),
    feeAuthorizedAt: timestamp('fee_authorized_at', { withTimezone: true }),
    quotaYouthMale: integer('quota_youth_male').notNull().default(0),
    quotaYouthFemale: integer('quota_youth_female').notNull().default(0),
    open: boolean('open').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('camps_slug_unique').on(table.slug),
    check('camps_slug_format', sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${table.slug}) <= 60`),
    check('camps_name_length', sql`char_length(${table.name}) between 2 and 120`),
    check('camps_description_length', sql`${table.description} is null or char_length(${table.description}) <= 2000`),
    check('camps_location_length', sql`char_length(${table.location}) between 2 and 160`),
    check('camps_dates', sql`${table.endDate} >= ${table.startDate} and ${table.registrationDeadline} <= ${table.endDate}`),
    check('camps_non_negative', sql`${table.feeYouth} >= 0 and ${table.feeLeader} >= 0 and ${table.quotaYouthMale} >= 0 and ${table.quotaYouthFemale} >= 0`),
    // Manual General 20.6.2: pedir un aporte exige que el obispado lo haya autorizado.
    check('camps_fee_needs_authorization', sql`(${table.feeYouth} = 0 and ${table.feeLeader} = 0) or ${table.feeAuthorized}`),
    check('camps_donation_category_length', sql`${table.donationCategoryName} is null or char_length(${table.donationCategoryName}) <= 80`),
    check('camps_donation_instructions_length', sql`${table.donationInstructions} is null or char_length(${table.donationInstructions}) <= 600`),
  ],
);

export const campRegistrations = pgTable(
  'camp_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campId: uuid('camp_id')
      .notNull()
      .references(() => camps.id, { onDelete: 'cascade' }),
    guardianName: text('guardian_name'),
    guardianPhone: text('guardian_phone'),
    guardianEmail: text('guardian_email'),
    consent: boolean('consent').notNull(),
    policyVersion: text('policy_version').notNull(),
    locale: text('locale').notNull().default('es'),
    ip: text('ip'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('camp_registrations_camp_id_idx').on(table.campId),
    check('camp_registrations_consent', sql`${table.consent}`),
    check('camp_registrations_locale_valid', sql`${table.locale} in ('es', 'pt', 'en')`),
    check('camp_registrations_guardian_email_lower', sql`${table.guardianEmail} is null or ${table.guardianEmail} = lower(${table.guardianEmail})`),
  ],
);

// Sin datos médicos: van en el formulario oficial «Permiso y autorización para dar atención
// médica», en papel y en poder del líder a cargo (Manual General 20.7.4 y 33.8).
export const campParticipants = pgTable(
  'camp_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => campRegistrations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    fullName: text('full_name').notNull(),
    birthDate: date('birth_date', { mode: 'string' }),
    gender: text('gender').notNull(),
    phone: text('phone'),
    email: text('email'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    permissionFormReceived: boolean('permission_form_received').notNull().default(false),
    permissionFormReceivedAt: timestamp('permission_form_received_at', { withTimezone: true }),
    permissionFormReceivedBy: uuid('permission_form_received_by').references(() => users.id, { onDelete: 'set null' }),
    approved: boolean('approved').notNull().default(false),
    suggestedContribution: numeric('suggested_contribution', { precision: 10, scale: 2 }).notNull().default('0'),
    accessTokenHash: text('access_token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('camp_participants_access_token_unique').on(table.accessTokenHash),
    index('camp_participants_registration_id_idx').on(table.registrationId),
    check('camp_participants_type_valid', sql`${table.type} in ('youth', 'leader')`),
    check('camp_participants_gender_valid', sql`${table.gender} in ('male', 'female')`),
    check('camp_participants_full_name_length', sql`char_length(${table.fullName}) between 2 and 160`),
    check('camp_participants_email_lower', sql`${table.email} is null or ${table.email} = lower(${table.email})`),
    check('camp_participants_youth_birth_date', sql`${table.type} = 'leader' or ${table.birthDate} is not null`),
    check(
      'camp_participants_youth_emergency_contact',
      sql`${table.type} = 'leader' or (${table.emergencyContactName} is not null and ${table.emergencyContactPhone} is not null)`,
    ),
    check('camp_participants_contribution_non_negative', sql`${table.suggestedContribution} >= 0`),
  ],
);

export const campPackingItems = pgTable(
  'camp_packing_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campId: uuid('camp_id')
      .notNull()
      .references(() => camps.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    detail: text('detail'),
    category: text('category').notNull(),
    appliesTo: text('applies_to').notNull().default('all'),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('camp_packing_items_camp_id_idx').on(table.campId, table.position),
    check('camp_packing_items_applies_to_valid', sql`${table.appliesTo} in ('all', 'youth', 'leader')`),
    check('camp_packing_items_name_length', sql`char_length(${table.name}) between 1 and 120`),
  ],
);

export const campPackingChecks = pgTable(
  'camp_packing_checks',
  {
    participantId: uuid('participant_id')
      .notNull()
      .references(() => campParticipants.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => campPackingItems.id, { onDelete: 'cascade' }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.participantId, table.itemId] })],
);

export const campSharedItems = pgTable(
  'camp_shared_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campId: uuid('camp_id')
      .notNull()
      .references(() => camps.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    quantityNeeded: integer('quantity_needed').notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('camp_shared_items_camp_id_idx').on(table.campId),
    check('camp_shared_items_quantity_positive', sql`${table.quantityNeeded} >= 1`),
    check('camp_shared_items_name_length', sql`char_length(${table.name}) between 1 and 120`),
  ],
);

export const campSharedAssignments = pgTable(
  'camp_shared_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sharedItemId: uuid('shared_item_id')
      .notNull()
      .references(() => campSharedItems.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => campParticipants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => [
    index('camp_shared_assignments_item_idx').on(table.sharedItemId),
    index('camp_shared_assignments_participant_idx').on(table.participantId),
    check('camp_shared_assignments_quantity_positive', sql`${table.quantity} >= 1`),
  ],
);
