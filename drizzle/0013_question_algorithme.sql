ALTER TYPE "public"."question_type" ADD VALUE IF NOT EXISTS 'ALGORITHME';--> statement-breakpoint
ALTER TABLE "question_versions" ADD COLUMN IF NOT EXISTS "algo" jsonb;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD COLUMN IF NOT EXISTS "code_answer" text;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD COLUMN IF NOT EXISTS "grading" jsonb;
