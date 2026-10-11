CREATE TABLE IF NOT EXISTS "help_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL REFERENCES "public"."attempts"("id") ON DELETE cascade,
	"message" text NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"answered_by" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "help_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "help_requests" FROM anon, authenticated;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "paused_sec" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_requests_attempt_idx" ON "help_requests" USING btree ("attempt_id","created_at");
