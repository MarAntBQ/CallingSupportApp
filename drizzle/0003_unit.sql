ALTER TABLE "installation" ADD COLUMN "unit_type" text DEFAULT 'ward' NOT NULL;--> statement-breakpoint
ALTER TABLE "installation" ADD COLUMN "unit_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "installation" ADD CONSTRAINT "installation_unit_type_valid" CHECK ("installation"."unit_type" in ('ward', 'branch'));