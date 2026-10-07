CREATE TABLE "callings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "callings_name_length" CHECK (char_length("callings"."name") between 2 and 80)
);
--> statement-breakpoint
CREATE TABLE "module_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"calling_id" uuid NOT NULL,
	"can_read" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_update" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_notify" boolean DEFAULT false NOT NULL,
	CONSTRAINT "module_permissions_module_valid" CHECK ("module_permissions"."module" in ('temple-trips', 'users', 'callings', 'permissions'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "organizations_name_length" CHECK (char_length("organizations"."name") between 2 and 80)
);
--> statement-breakpoint
CREATE TABLE "user_callings" (
	"user_id" uuid NOT NULL,
	"calling_id" uuid NOT NULL,
	CONSTRAINT "user_callings_user_id_calling_id_pk" PRIMARY KEY("user_id","calling_id")
);
--> statement-breakpoint
ALTER TABLE "callings" ADD CONSTRAINT "callings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_permissions" ADD CONSTRAINT "module_permissions_calling_id_callings_id_fk" FOREIGN KEY ("calling_id") REFERENCES "public"."callings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_callings" ADD CONSTRAINT "user_callings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_callings" ADD CONSTRAINT "user_callings_calling_id_callings_id_fk" FOREIGN KEY ("calling_id") REFERENCES "public"."callings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "callings_organization_name_unique" ON "callings" USING btree ("organization_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "module_permissions_module_calling_unique" ON "module_permissions" USING btree ("module","calling_id");--> statement-breakpoint
CREATE INDEX "module_permissions_calling_id_idx" ON "module_permissions" USING btree ("calling_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_name_unique" ON "organizations" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "user_callings_calling_id_idx" ON "user_callings" USING btree ("calling_id");