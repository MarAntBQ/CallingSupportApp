CREATE TABLE "camp_packing_checks" (
	"participant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camp_packing_checks_participant_id_item_id_pk" PRIMARY KEY("participant_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "camp_packing_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"camp_id" uuid NOT NULL,
	"name" text NOT NULL,
	"detail" text,
	"category" text NOT NULL,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "camp_packing_items_applies_to_valid" CHECK ("camp_packing_items"."applies_to" in ('all', 'youth', 'leader')),
	CONSTRAINT "camp_packing_items_name_length" CHECK (char_length("camp_packing_items"."name") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "camp_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"type" text NOT NULL,
	"full_name" text NOT NULL,
	"birth_date" date,
	"gender" text NOT NULL,
	"phone" text,
	"email" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"permission_form_received" boolean DEFAULT false NOT NULL,
	"permission_form_received_at" timestamp with time zone,
	"permission_form_received_by" uuid,
	"approved" boolean DEFAULT false NOT NULL,
	"suggested_contribution" numeric(10, 2) DEFAULT '0' NOT NULL,
	"access_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camp_participants_type_valid" CHECK ("camp_participants"."type" in ('youth', 'leader')),
	CONSTRAINT "camp_participants_gender_valid" CHECK ("camp_participants"."gender" in ('male', 'female')),
	CONSTRAINT "camp_participants_full_name_length" CHECK (char_length("camp_participants"."full_name") between 2 and 160),
	CONSTRAINT "camp_participants_email_lower" CHECK ("camp_participants"."email" is null or "camp_participants"."email" = lower("camp_participants"."email")),
	CONSTRAINT "camp_participants_youth_birth_date" CHECK ("camp_participants"."type" = 'leader' or "camp_participants"."birth_date" is not null),
	CONSTRAINT "camp_participants_youth_emergency_contact" CHECK ("camp_participants"."type" = 'leader' or ("camp_participants"."emergency_contact_name" is not null and "camp_participants"."emergency_contact_phone" is not null)),
	CONSTRAINT "camp_participants_contribution_non_negative" CHECK ("camp_participants"."suggested_contribution" >= 0)
);
--> statement-breakpoint
CREATE TABLE "camp_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"camp_id" uuid NOT NULL,
	"guardian_name" text,
	"guardian_phone" text,
	"guardian_email" text,
	"consent" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"ip" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camp_registrations_consent" CHECK ("camp_registrations"."consent"),
	CONSTRAINT "camp_registrations_locale_valid" CHECK ("camp_registrations"."locale" in ('es', 'pt', 'en')),
	CONSTRAINT "camp_registrations_guardian_email_lower" CHECK ("camp_registrations"."guardian_email" is null or "camp_registrations"."guardian_email" = lower("camp_registrations"."guardian_email"))
);
--> statement-breakpoint
CREATE TABLE "camp_shared_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shared_item_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"confirmed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "camp_shared_assignments_quantity_positive" CHECK ("camp_shared_assignments"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "camp_shared_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"camp_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity_needed" integer NOT NULL,
	"notes" text,
	CONSTRAINT "camp_shared_items_quantity_positive" CHECK ("camp_shared_items"."quantity_needed" >= 1),
	CONSTRAINT "camp_shared_items_name_length" CHECK (char_length("camp_shared_items"."name") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "camps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"location" text NOT NULL,
	"registration_deadline" date NOT NULL,
	"fee_youth" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fee_leader" numeric(10, 2) DEFAULT '0' NOT NULL,
	"donation_category_name" text,
	"donation_instructions" text,
	"fee_authorized" boolean DEFAULT false NOT NULL,
	"fee_authorized_by" uuid,
	"fee_authorized_at" timestamp with time zone,
	"quota_youth_male" integer DEFAULT 0 NOT NULL,
	"quota_youth_female" integer DEFAULT 0 NOT NULL,
	"open" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camps_slug_format" CHECK ("camps"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("camps"."slug") <= 60),
	CONSTRAINT "camps_name_length" CHECK (char_length("camps"."name") between 2 and 120),
	CONSTRAINT "camps_description_length" CHECK ("camps"."description" is null or char_length("camps"."description") <= 2000),
	CONSTRAINT "camps_location_length" CHECK (char_length("camps"."location") between 2 and 160),
	CONSTRAINT "camps_dates" CHECK ("camps"."end_date" >= "camps"."start_date" and "camps"."registration_deadline" <= "camps"."end_date"),
	CONSTRAINT "camps_non_negative" CHECK ("camps"."fee_youth" >= 0 and "camps"."fee_leader" >= 0 and "camps"."quota_youth_male" >= 0 and "camps"."quota_youth_female" >= 0),
	CONSTRAINT "camps_fee_needs_authorization" CHECK (("camps"."fee_youth" = 0 and "camps"."fee_leader" = 0) or "camps"."fee_authorized"),
	CONSTRAINT "camps_fee_authorization_dated" CHECK ("camps"."fee_authorized" = ("camps"."fee_authorized_at" is not null)),
	CONSTRAINT "camps_fee_authorizer_only_when_authorized" CHECK ("camps"."fee_authorized" or "camps"."fee_authorized_by" is null),
	CONSTRAINT "camps_donation_category_length" CHECK ("camps"."donation_category_name" is null or char_length("camps"."donation_category_name") <= 80),
	CONSTRAINT "camps_donation_instructions_length" CHECK ("camps"."donation_instructions" is null or char_length("camps"."donation_instructions") <= 600)
);
--> statement-breakpoint
ALTER TABLE "module_permissions" DROP CONSTRAINT "module_permissions_module_valid";--> statement-breakpoint
ALTER TABLE "camp_packing_checks" ADD CONSTRAINT "camp_packing_checks_participant_id_camp_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."camp_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_packing_checks" ADD CONSTRAINT "camp_packing_checks_item_id_camp_packing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."camp_packing_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_packing_items" ADD CONSTRAINT "camp_packing_items_camp_id_camps_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_participants" ADD CONSTRAINT "camp_participants_registration_id_camp_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."camp_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_participants" ADD CONSTRAINT "camp_participants_permission_form_received_by_users_id_fk" FOREIGN KEY ("permission_form_received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_registrations" ADD CONSTRAINT "camp_registrations_camp_id_camps_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_registrations" ADD CONSTRAINT "camp_registrations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_shared_assignments" ADD CONSTRAINT "camp_shared_assignments_shared_item_id_camp_shared_items_id_fk" FOREIGN KEY ("shared_item_id") REFERENCES "public"."camp_shared_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_shared_assignments" ADD CONSTRAINT "camp_shared_assignments_participant_id_camp_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."camp_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_shared_items" ADD CONSTRAINT "camp_shared_items_camp_id_camps_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camps" ADD CONSTRAINT "camps_fee_authorized_by_users_id_fk" FOREIGN KEY ("fee_authorized_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "camp_packing_items_camp_id_idx" ON "camp_packing_items" USING btree ("camp_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "camp_participants_access_token_unique" ON "camp_participants" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "camp_participants_registration_id_idx" ON "camp_participants" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "camp_registrations_camp_id_idx" ON "camp_registrations" USING btree ("camp_id");--> statement-breakpoint
CREATE INDEX "camp_shared_assignments_item_idx" ON "camp_shared_assignments" USING btree ("shared_item_id");--> statement-breakpoint
CREATE INDEX "camp_shared_assignments_participant_idx" ON "camp_shared_assignments" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "camp_shared_items_camp_id_idx" ON "camp_shared_items" USING btree ("camp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "camps_slug_unique" ON "camps" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "module_permissions" ADD CONSTRAINT "module_permissions_module_valid" CHECK ("module_permissions"."module" in ('temple-trips', 'users', 'callings', 'permissions', 'self-reliance', 'camps'));