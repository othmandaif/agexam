-- Année scolaire « AAAA-AAAA » : du 1er septembre au 31 août, heure du Maroc.
CREATE OR REPLACE FUNCTION public.academic_year_of(ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN extract(month FROM ts AT TIME ZONE 'Africa/Casablanca') >= 9
      THEN extract(year FROM ts AT TIME ZONE 'Africa/Casablanca')::int::text || '-' ||
           (extract(year FROM ts AT TIME ZONE 'Africa/Casablanca')::int + 1)::text
    ELSE (extract(year FROM ts AT TIME ZONE 'Africa/Casablanca')::int - 1)::text || '-' ||
         extract(year FROM ts AT TIME ZONE 'Africa/Casablanca')::int::text
  END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.academic_year_of(timestamptz) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
-- Examens : année de leur date d'ouverture (sinon de création).
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "academic_year" text;--> statement-breakpoint
UPDATE "exams" SET "academic_year" = public.academic_year_of(coalesce("opens_at", "created_at")) WHERE "academic_year" IS NULL;--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "academic_year" SET DEFAULT public.academic_year_of(now());--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "academic_year" SET NOT NULL;--> statement-breakpoint
-- Groupes : année de création.
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "academic_year" text;--> statement-breakpoint
UPDATE "groups" SET "academic_year" = public.academic_year_of("created_at") WHERE "academic_year" IS NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "academic_year" SET DEFAULT public.academic_year_of(now());--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "academic_year" SET NOT NULL;--> statement-breakpoint
-- Comptes : année la plus récente entre la création et leurs groupes.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "academic_year" text;--> statement-breakpoint
UPDATE "profiles" p SET "academic_year" = greatest(
  public.academic_year_of(p."created_at"),
  coalesce((SELECT max(g."academic_year") FROM "group_members" gm
            JOIN "groups" g ON g."id" = gm."group_id" WHERE gm."profile_id" = p."id"), '')
) WHERE "academic_year" IS NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "academic_year" SET DEFAULT public.academic_year_of(now());--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "academic_year" SET NOT NULL;--> statement-breakpoint
-- Un même nom de groupe (« DEV101 ») chaque année.
DROP INDEX IF EXISTS "groups_name_uq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "groups_name_year_uq" ON "groups" USING btree ("establishment_id","academic_year","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_year_idx" ON "exams" USING btree ("establishment_id","academic_year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_year_idx" ON "profiles" USING btree ("establishment_id","role","academic_year");
