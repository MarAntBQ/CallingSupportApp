CREATE TABLE "app_config" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"unit_name" text DEFAULT '' NOT NULL,
	"allow_registration" boolean DEFAULT false NOT NULL,
	"logo_data_url" text,
	"timezone" text DEFAULT 'America/Guayaquil' NOT NULL,
	"default_locale" text DEFAULT 'es' NOT NULL,
	"contact" text,
	"controller_name" text,
	"controller_email" text,
	"controller_city" text,
	"controller_website" text,
	"retention_months" integer DEFAULT 12 NOT NULL,
	"policy_version" text DEFAULT '2026-10' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_config_single_row" CHECK ("app_config"."id" = 1),
	CONSTRAINT "app_config_default_locale_valid" CHECK ("app_config"."default_locale" in ('es', 'pt', 'en')),
	CONSTRAINT "app_config_retention_months_range" CHECK ("app_config"."retention_months" between 1 and 120),
	CONSTRAINT "app_config_logo_size" CHECK ("app_config"."logo_data_url" is null or char_length("app_config"."logo_data_url") <= 3000000),
	CONSTRAINT "app_config_controller_email_lowercase" CHECK ("app_config"."controller_email" is null or "app_config"."controller_email" = lower("app_config"."controller_email"))
);
--> statement-breakpoint
INSERT INTO "app_config" ("id", "unit_name") VALUES (1, coalesce((SELECT "unit_name" FROM "installation" WHERE "id" = 1), '')) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "installation" DROP COLUMN "unit_name";