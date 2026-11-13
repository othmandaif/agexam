CREATE TABLE "homework_groups" (
	"homework_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "homework_groups_homework_id_group_id_pk" PRIMARY KEY("homework_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "homework_handins" (
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"code" text NOT NULL,
	"trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homework_handins_homework_id_student_id_pk" PRIMARY KEY("homework_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "homework_hint_views" (
	"step_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homework_hint_views_step_id_student_id_pk" PRIMARY KEY("step_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "homework_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_id" uuid NOT NULL,
	"step_no" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"starter_code" text DEFAULT '' NOT NULL,
	"solution_code" text NOT NULL,
	"tests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"code" text NOT NULL,
	"passed" boolean NOT NULL,
	"passed_count" integer NOT NULL,
	"total_count" integer NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homeworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL,
	"author_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"session_label" text,
	"due_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	"academic_year" text DEFAULT public.academic_year_of(now()) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_groups" ADD CONSTRAINT "homework_groups_homework_id_homeworks_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homeworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_groups" ADD CONSTRAINT "homework_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_handins" ADD CONSTRAINT "homework_handins_homework_id_homeworks_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homeworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_handins" ADD CONSTRAINT "homework_handins_student_id_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_hint_views" ADD CONSTRAINT "homework_hint_views_step_id_homework_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."homework_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_hint_views" ADD CONSTRAINT "homework_hint_views_student_id_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_steps" ADD CONSTRAINT "homework_steps_homework_id_homeworks_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homeworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_step_id_homework_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."homework_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_id_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_groups_group_idx" ON "homework_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "homework_steps_hw_idx" ON "homework_steps" USING btree ("homework_id","step_no");--> statement-breakpoint
CREATE INDEX "homework_submissions_student_idx" ON "homework_submissions" USING btree ("student_id","step_id","created_at");--> statement-breakpoint
CREATE INDEX "homeworks_year_idx" ON "homeworks" USING btree ("establishment_id","academic_year");--> statement-breakpoint
ALTER TABLE "homeworks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "homework_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "homework_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "homework_hint_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "homework_handins" ENABLE ROW LEVEL SECURITY;
