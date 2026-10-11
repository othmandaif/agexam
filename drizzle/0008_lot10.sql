ALTER TYPE "public"."security_event_type" ADD VALUE IF NOT EXISTS 'OTHER_DEVICE';--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "violation_policy" SET DEFAULT '["AVERTISSEMENT","INVALIDER_QUESTION"]'::jsonb;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "bonus_points" numeric(4, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD COLUMN IF NOT EXISTS "violation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "session_id" text;
