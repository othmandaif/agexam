-- Les groupes et les comptes étudiants appartiennent au formateur qui les crée.
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_profiles_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_profiles_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groups_owner_idx" ON "groups" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_created_by_idx" ON "profiles" USING btree ("created_by");
--> statement-breakpoint
-- Transfert des groupes existants (aucune donnée supprimée ni déplacée : seul le propriétaire est renseigné).
-- Un formateur n'est retenu que si UN SEUL profil correspond au nom ; sinon le groupe reste visible de tous.
DO $$
DECLARE
  hamdaoui uuid;
  daif uuid;
  n int;
BEGIN
  SELECT count(*) INTO n FROM profiles
   WHERE role = 'FORMATEUR' AND full_name ILIKE '%hamdaoui%' AND full_name ILIKE '%ayoub%';
  IF n = 1 THEN
    SELECT id INTO hamdaoui FROM profiles
     WHERE role = 'FORMATEUR' AND full_name ILIKE '%hamdaoui%' AND full_name ILIKE '%ayoub%';
    UPDATE groups SET owner_id = hamdaoui
     WHERE owner_id IS NULL AND upper(name) IN ('INFO207', 'INFO209');
  END IF;

  SELECT count(*) INTO n FROM profiles
   WHERE role = 'FORMATEUR' AND full_name ILIKE '%daif%' AND full_name ILIKE '%othman%';
  IF n = 1 THEN
    SELECT id INTO daif FROM profiles
     WHERE role = 'FORMATEUR' AND full_name ILIKE '%daif%' AND full_name ILIKE '%othman%';
    UPDATE groups SET owner_id = daif
     WHERE owner_id IS NULL AND upper(name) = 'DEV104';
  END IF;
END $$;
--> statement-breakpoint
-- Les étudiants de ces groupes sont rattachés au formateur propriétaire (seulement s'ils n'ont pas déjà un créateur).
UPDATE profiles p SET created_by = s.owner_id
  FROM (
    SELECT gm.profile_id, min(g.owner_id::text)::uuid AS owner_id
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
     WHERE g.owner_id IS NOT NULL
     GROUP BY gm.profile_id
  ) s
 WHERE p.id = s.profile_id AND p.role = 'ETUDIANT' AND p.created_by IS NULL;
