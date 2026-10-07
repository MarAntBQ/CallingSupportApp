import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const emailLog = pgTable(
  'email_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    emailTo: text('email_to').notNull(),
    emailSubject: text('email_subject').notNull(),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('email_log_created_at_idx').on(table.createdAt)],
);
