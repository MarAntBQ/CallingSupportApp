CREATE TABLE "temple_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"id_number" text NOT NULL,
	"birth_date" date NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"gender" text NOT NULL,
	"wants_transport" boolean DEFAULT false NOT NULL,
	"needs_lodging" boolean DEFAULT false NOT NULL,
	"wants_breakfast" boolean DEFAULT false NOT NULL,
	"wants_lunch" boolean DEFAULT false NOT NULL,
	"ordinances" text[] DEFAULT '{}' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"price_transport" numeric(10, 2) DEFAULT '0' NOT NULL,
	"price_breakfast" numeric(10, 2) DEFAULT '0' NOT NULL,
	"price_lunch" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temple_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"ip" text,
	"consent" boolean DEFAULT false NOT NULL,
	"policy_version" text NOT NULL,
	"locale" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "temple_participants" ADD CONSTRAINT "temple_participants_registration_id_temple_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."temple_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temple_registrations" ADD CONSTRAINT "temple_registrations_trip_id_temple_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."temple_trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temple_registrations" ADD CONSTRAINT "temple_registrations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;