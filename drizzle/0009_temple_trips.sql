CREATE TABLE "temple_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"registration_deadline" date NOT NULL,
	"date_confirmed" boolean DEFAULT true NOT NULL,
	"includes_transport" boolean DEFAULT false NOT NULL,
	"includes_lodging" boolean DEFAULT false NOT NULL,
	"includes_breakfast" boolean DEFAULT false NOT NULL,
	"includes_lunch" boolean DEFAULT false NOT NULL,
	"quota_transport" integer DEFAULT 0 NOT NULL,
	"quota_lodging" integer DEFAULT 0 NOT NULL,
	"cost_transport" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost_breakfast" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost_lunch" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quota_baptism_male" integer DEFAULT 0 NOT NULL,
	"quota_baptism_female" integer DEFAULT 0 NOT NULL,
	"quota_initiatory_male" integer DEFAULT 0 NOT NULL,
	"quota_initiatory_female" integer DEFAULT 0 NOT NULL,
	"quota_endowment_male" integer DEFAULT 0 NOT NULL,
	"quota_endowment_female" integer DEFAULT 0 NOT NULL,
	"quota_sealing_male" integer DEFAULT 0 NOT NULL,
	"quota_sealing_female" integer DEFAULT 0 NOT NULL,
	"temple_name" text NOT NULL,
	"in_assigned_district" boolean DEFAULT true NOT NULL,
	"scheduled_with_temple" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temple_trips_name_length" CHECK (char_length("temple_trips"."temple_name") between 2 and 120),
	CONSTRAINT "temple_trips_deadline_before_date" CHECK ("temple_trips"."registration_deadline" <= "temple_trips"."date"),
	CONSTRAINT "temple_trips_scheduled_to_activate" CHECK ("temple_trips"."active" = false or "temple_trips"."scheduled_with_temple" = true),
	CONSTRAINT "temple_trips_non_negative" CHECK ("temple_trips"."quota_transport" >= 0 and "temple_trips"."quota_lodging" >= 0 and "temple_trips"."cost_transport" >= 0 and "temple_trips"."cost_breakfast" >= 0 and "temple_trips"."cost_lunch" >= 0
        and "temple_trips"."quota_baptism_male" >= 0 and "temple_trips"."quota_baptism_female" >= 0 and "temple_trips"."quota_initiatory_male" >= 0 and "temple_trips"."quota_initiatory_female" >= 0
        and "temple_trips"."quota_endowment_male" >= 0 and "temple_trips"."quota_endowment_female" >= 0 and "temple_trips"."quota_sealing_male" >= 0 and "temple_trips"."quota_sealing_female" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "temple_trips_one_active" ON "temple_trips" USING btree ("active") WHERE "temple_trips"."active";