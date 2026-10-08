ALTER TABLE "temple_trips" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "temple_trips" ADD COLUMN "purged_participants" integer DEFAULT 0 NOT NULL;