ALTER TYPE "public"."question_type" ADD VALUE IF NOT EXISTS 'REDACTION';
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "released_at" timestamp with time zone;
