CREATE TABLE IF NOT EXISTS "algo_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL REFERENCES "public"."establishments"("id") ON DELETE cascade,
	"author_id" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
	"title" text NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"academic_year" text DEFAULT public.academic_year_of(now()) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "algo_track_groups" (
	"track_id" uuid NOT NULL REFERENCES "public"."algo_tracks"("id") ON DELETE cascade,
	"group_id" uuid NOT NULL REFERENCES "public"."groups"("id") ON DELETE cascade,
	CONSTRAINT "algo_track_groups_track_id_group_id_pk" PRIMARY KEY("track_id","group_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "algo_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL REFERENCES "public"."algo_tracks"("id") ON DELETE cascade,
	"level" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"starter_code" text DEFAULT '' NOT NULL,
	"solution_code" text NOT NULL,
	"tests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "algo_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL REFERENCES "public"."algo_exercises"("id") ON DELETE cascade,
	"student_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE cascade,
	"code" text NOT NULL,
	"passed" boolean NOT NULL,
	"passed_count" integer NOT NULL,
	"total_count" integer NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "algo_tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "algo_track_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "algo_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "algo_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "algo_tracks", "algo_track_groups", "algo_exercises", "algo_submissions" FROM anon, authenticated;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algo_exercises_track_idx" ON "algo_exercises" USING btree ("track_id","level","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algo_submissions_student_idx" ON "algo_submissions" USING btree ("student_id","exercise_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algo_track_groups_group_idx" ON "algo_track_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algo_tracks_year_idx" ON "algo_tracks" USING btree ("establishment_id","academic_year");
