ALTER TABLE "users" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_policy_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_locale" text;