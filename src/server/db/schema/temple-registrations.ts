import { sql } from 'drizzle-orm';
import { boolean, check, date, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { templeTrips } from './temple-trips';

export const templeRooms = pgTable('temple_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .notNull()
    .references(() => templeTrips.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templeRegistrations = pgTable(
  'temple_registrations',
  {
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
  },
  (table) => [index('temple_registrations_trip_id_idx').on(table.tripId)],
);

export const templeParticipants = pgTable(
  'temple_participants',
  {
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
    // Habitaciones del templo (#23): nullables; last/first names y nationality solo para el Excel.
    roomId: uuid('room_id').references(() => templeRooms.id, { onDelete: 'set null' }),
    roomRole: text('room_role'),
    lastNames: text('last_names'),
    firstNames: text('first_names'),
    nationality: text('nationality'),
    // Logística del día del viaje (#24): el líder las marca en las listas imprimibles.
    boardedOutbound: boolean('boarded_outbound').notNull().default(false),
    boardedReturn: boolean('boarded_return').notNull().default(false),
    breakfastDelivered: boolean('breakfast_delivered').notNull().default(false),
    lunchDelivered: boolean('lunch_delivered').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('temple_participants_registration_approved_idx').on(table.registrationId, table.approved),
    index('temple_participants_room_id_idx').on(table.roomId),
    check('temple_participants_room_role_valid', sql`${table.roomRole} is null or ${table.roomRole} in ('leader', 'guest')`),
  ],
);
