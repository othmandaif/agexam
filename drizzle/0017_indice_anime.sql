ALTER TABLE "homework_steps" ADD COLUMN IF NOT EXISTS "hint_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "homework_steps" ADD COLUMN IF NOT EXISTS "hint_inputs" jsonb;