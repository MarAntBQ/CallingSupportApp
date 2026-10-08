ALTER TABLE "temple_participants" ADD COLUMN "boarded_outbound" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "boarded_return" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "breakfast_delivered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "temple_participants" ADD COLUMN "lunch_delivered" boolean DEFAULT false NOT NULL;