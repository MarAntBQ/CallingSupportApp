ALTER TABLE "users" ADD COLUMN "otp_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "otp_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_otp_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_otp_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_hash" text;