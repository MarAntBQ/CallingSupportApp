CREATE TABLE "self_reliance_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"locale" text DEFAULT 'all' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_reliance_resources_title_length" CHECK (char_length("self_reliance_resources"."title") between 2 and 120),
	CONSTRAINT "self_reliance_resources_description_length" CHECK ("self_reliance_resources"."description" is null or char_length("self_reliance_resources"."description") <= 400),
	CONSTRAINT "self_reliance_resources_url_https" CHECK ("self_reliance_resources"."url" like 'https://%' and char_length("self_reliance_resources"."url") <= 2048),
	CONSTRAINT "self_reliance_resources_category_valid" CHECK ("self_reliance_resources"."category" in ('courses', 'employment', 'education', 'personal_finances', 'business', 'emotional_resilience', 'languages', 'life_skills', 'other')),
	CONSTRAINT "self_reliance_resources_locale_valid" CHECK ("self_reliance_resources"."locale" in ('all', 'es', 'pt', 'en'))
);
--> statement-breakpoint
ALTER TABLE "module_permissions" DROP CONSTRAINT "module_permissions_module_valid";--> statement-breakpoint
ALTER TABLE "self_reliance_resources" ADD CONSTRAINT "self_reliance_resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "self_reliance_resources_position_idx" ON "self_reliance_resources" USING btree ("position");--> statement-breakpoint
ALTER TABLE "module_permissions" ADD CONSTRAINT "module_permissions_module_valid" CHECK ("module_permissions"."module" in ('temple-trips', 'users', 'callings', 'permissions', 'self-reliance'));--> statement-breakpoint
-- Semilla (#35): los 8 recursos oficiales de https://www.churchofjesuschrist.org/self-reliance, en todos los idiomas.
INSERT INTO "self_reliance_resources" ("title", "url", "category", "locale", "position") VALUES
	('Cursos de autosuficiencia', 'https://www.churchofjesuschrist.org/life/self-reliance/courses', 'courses', 'all', 1),
	('Resiliencia emocional', 'https://www.churchofjesuschrist.org/life/self-reliance/emotional-resilience', 'emotional_resilience', 'all', 2),
	('Finanzas personales', 'https://www.churchofjesuschrist.org/life/self-reliance/personal-finances', 'personal_finances', 'all', 3),
	('Encontrar un mejor empleo', 'https://www.churchofjesuschrist.org/life/self-reliance/find-a-better-job', 'employment', 'all', 4),
	('Educación para un mejor empleo', 'https://www.churchofjesuschrist.org/life/self-reliance/education-for-better-work', 'education', 'all', 5),
	('EnglishConnect', 'https://englishconnect.org', 'languages', 'all', 6),
	('Iniciar y hacer crecer mi negocio', 'https://www.churchofjesuschrist.org/life/starting-and-growing-my-business', 'business', 'all', 7),
	('Habilidades para la vida', 'https://www.churchofjesuschrist.org/self-reliance/course-materials/life-skills', 'life_skills', 'all', 8);
