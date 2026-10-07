import { boolean, date, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { templeTrips } from './temple-trips';

export const templeRegistrations = pgTable('temple_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .notNull()
    .references(() => templeTrips.id, { onDelete: 'cascade' }),
  ip: text('ip'),
  consent: boolean('consent').notNull().default(false),
  policyVersion: text('policy_version').notNull(),
  locale: text('locale').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templeParticipants = pgTable('temple_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  registrationId: uuid('registration_id')
    .notNull()
    .references(() => templeRegistrations.id, { onDelete: 'cascade' }),
  idNumber: text('id_number').notNull(),
  birthDate: date('birth_date', { mode: 'string' }).notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  gender: text('gender').notNull(),
  wantsTransport: boolean('wants_transport').notNull().default(false),
  needsLodging: boolean('needs_lodging').notNull().default(false),
  wantsBreakfast: boolean('wants_breakfast').notNull().default(false),
  wantsLunch: boolean('wants_lunch').notNull().default(false),
  ordinances: text('ordinances').array().notNull().default([]),
  approved: boolean('approved').notNull().default(false),
  priceTransport: numeric('price_transport', { precision: 10, scale: 2 }).notNull().default('0'),
  priceBreakfast: numeric('price_breakfast', { precision: 10, scale: 2 }).notNull().default('0'),
  priceLunch: numeric('price_lunch', { precision: 10, scale: 2 }).notNull().default('0'),
  totalCost: numeric('total_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
