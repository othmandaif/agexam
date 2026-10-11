DO $$ BEGIN
  CREATE TYPE "public"."timer_mode" AS ENUM('PAR_QUESTION', 'GLOBAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "timer_mode" "public"."timer_mode" DEFAULT 'PAR_QUESTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "global_duration_sec" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "deadline_at" timestamp with time zone;