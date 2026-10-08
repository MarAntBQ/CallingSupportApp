import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

// Portal de Autosuficiencia (#35): solo recursos públicos y gratuitos. `official` no se guarda,
// se calcula del dominio de la URL (src/lib/self-reliance/constants.ts).
export const selfRelianceResources = pgTable(
  'self_reliance_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    url: text('url').notNull(),
    category: text('category').notNull(),
    locale: text('locale').notNull().default('all'),
    position: integer('position').notNull().default(0),
    published: boolean('published').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('self_reliance_resources_position_idx').on(table.position),
    check('self_reliance_resources_title_length', sql`char_length(${table.title}) between 2 and 120`),
    check('self_reliance_resources_description_length', sql`${table.description} is null or char_length(${table.description}) <= 400`),
    check('self_reliance_resources_url_https', sql`${table.url} like 'https://%' and char_length(${table.url}) <= 2048`),
    check(
      'self_reliance_resources_category_valid',
      sql`${table.category} in ('courses', 'employment', 'education', 'personal_finances', 'business', 'emotional_resilience', 'languages', 'life_skills', 'other')`,
    ),
    check('self_reliance_resources_locale_valid', sql`${table.locale} in ('all', 'es', 'pt', 'en')`),
  ],
);
