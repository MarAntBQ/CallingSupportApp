import { sql } from 'drizzle-orm';
import { boolean, check, date, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const templeTrips = pgTable(
  'temple_trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    registrationDeadline: date('registration_deadline', { mode: 'string' }).notNull(),
    dateConfirmed: boolean('date_confirmed').notNull().default(true),

    includesTransport: boolean('includes_transport').notNull().default(false),
    includesLodging: boolean('includes_lodging').notNull().default(false),
    includesBreakfast: boolean('includes_breakfast').notNull().default(false),
    includesLunch: boolean('includes_lunch').notNull().default(false),

    quotaTransport: integer('quota_transport').notNull().default(0),
    quotaLodging: integer('quota_lodging').notNull().default(0),

    costTransport: numeric('cost_transport', { precision: 10, scale: 2 }).notNull().default('0'),
    costBreakfast: numeric('cost_breakfast', { precision: 10, scale: 2 }).notNull().default('0'),
    costLunch: numeric('cost_lunch', { precision: 10, scale: 2 }).notNull().default('0'),

    quotaBaptismMale: integer('quota_baptism_male').notNull().default(0),
    quotaBaptismFemale: integer('quota_baptism_female').notNull().default(0),
    quotaInitiatoryMale: integer('quota_initiatory_male').notNull().default(0),
    quotaInitiatoryFemale: integer('quota_initiatory_female').notNull().default(0),
    quotaEndowmentMale: integer('quota_endowment_male').notNull().default(0),
    quotaEndowmentFemale: integer('quota_endowment_female').notNull().default(0),
    quotaSealingMale: integer('quota_sealing_male').notNull().default(0),
    quotaSealingFemale: integer('quota_sealing_female').notNull().default(0),

    templeName: text('temple_name').notNull(),
    inAssignedDistrict: boolean('in_assigned_district').notNull().default(true),
    scheduledWithTemple: boolean('scheduled_with_temple').notNull().default(false),

    // La app NO maneja dinero (Manual General 34): solo muestra la categoría de donativo que el
    // obispado ya tenga autorizada y cómo contribuir. No crea categorías ni registra pagos.
    donationCategoryName: text('donation_category_name'),
    donationInstructions: text('donation_instructions'),

    active: boolean('active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Retención (#26): cuándo se purgaron inscripciones vencidas de este viaje y cuántos
    // participantes se borraron en total. El viaje permanece; los datos de personas no.
    purgedAt: timestamp('purged_at', { withTimezone: true }),
    purgedParticipants: integer('purged_participants').notNull().default(0),
  },
  (table) => [
    uniqueIndex('temple_trips_one_active').on(table.active).where(sql`${table.active}`),
    check('temple_trips_name_length', sql`char_length(${table.templeName}) between 2 and 120`),
    check('temple_trips_deadline_before_date', sql`${table.registrationDeadline} <= ${table.date}`),
    check(
      'temple_trips_scheduled_to_activate',
      sql`${table.active} = false or ${table.scheduledWithTemple} = true`,
    ),
    check(
      'temple_trips_non_negative',
      sql`${table.quotaTransport} >= 0 and ${table.quotaLodging} >= 0 and ${table.costTransport} >= 0 and ${table.costBreakfast} >= 0 and ${table.costLunch} >= 0
        and ${table.quotaBaptismMale} >= 0 and ${table.quotaBaptismFemale} >= 0 and ${table.quotaInitiatoryMale} >= 0 and ${table.quotaInitiatoryFemale} >= 0
        and ${table.quotaEndowmentMale} >= 0 and ${table.quotaEndowmentFemale} >= 0 and ${table.quotaSealingMale} >= 0 and ${table.quotaSealingFemale} >= 0`,
    ),
    check('temple_trips_donation_category_length', sql`${table.donationCategoryName} is null or char_length(${table.donationCategoryName}) <= 80`),
    check('temple_trips_donation_instructions_length', sql`${table.donationInstructions} is null or char_length(${table.donationInstructions}) <= 600`),
  ],
);
