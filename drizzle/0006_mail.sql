CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"email_to" text NOT NULL,
	"email_subject" text NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "smtp_secure" boolean;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "smtp_user" text;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "smtp_password_enc" text;--> statement-breakpoint
CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_smtp_port_range" CHECK ("app_config"."smtp_port" is null or "app_config"."smtp_port" between 1 and 65535);