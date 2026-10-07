CREATE TABLE "temple_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "default_nationality" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "room_role" text;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "last_names" text;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "first_names" text;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "temple_rooms" ADD CONSTRAINT "temple_rooms_trip_id_temple_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."temple_trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD CONSTRAINT "temple_participants_room_id_temple_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."temple_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "temple_participants_room_id_idx" ON "temple_participants" USING btree ("room_id");--> statement-breakpoint
ALTER TABLE "temple_participants" ADD CONSTRAINT "temple_participants_room_role_valid" CHECK ("temple_participants"."room_role" is null or "temple_participants"."room_role" in ('leader', 'guest'));