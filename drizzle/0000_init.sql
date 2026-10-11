CREATE TYPE "public"."attempt_question_status" AS ENUM('A_VENIR', 'EN_COURS', 'REPONDUE', 'EXPIREE', 'INVALIDEE', 'NEUTRALISEE');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('EN_COURS', 'SOUMISE', 'SOUMISE_AUTO', 'EXPIREE', 'ANNULEE');--> statement-breakpoint
CREATE TYPE "public"."code_language" AS ENUM('PSEUDO_CODE', 'PYTHON', 'JAVASCRIPT', 'SQL', 'C', 'JAVA', 'AUTRE');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('FACILE', 'MOYENNE', 'DIFFICILE');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('BROUILLON', 'PLANIFIE', 'OUVERT', 'FERME', 'ARCHIVE');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('QCM_SIMPLE', 'QCM_MULTIPLE', 'VRAI_FAUX', 'TRACE_ALGORITHME', 'RECHERCHE_ERREUR', 'COMPLEXITE');--> statement-breakpoint
CREATE TYPE "public"."result_release_mode" AS ENUM('IMMEDIAT', 'APRES_FERMETURE', 'MANUEL');--> statement-breakpoint
CREATE TYPE "public"."result_visibility" AS ENUM('AUCUNE', 'NOTE', 'NOTE_DETAIL', 'CORRECTION');--> statement-breakpoint
CREATE TYPE "public"."sanction_type" AS ENUM('AUCUNE', 'AVERTISSEMENT', 'INVALIDER_QUESTION', 'PENALITE', 'SOUMISSION_AUTO');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('FULLSCREEN_EXIT', 'FULLSCREEN_ENTER', 'VISIBILITY_HIDDEN', 'VISIBILITY_VISIBLE', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'PAGE_RELOAD', 'NETWORK_LOST', 'NETWORK_RESTORED', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CONTEXT_MENU');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'FORMATEUR', 'ETUDIANT');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "establishments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_profile_id_pk" PRIMARY KEY("group_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"establishment_id" uuid,
	"role" "user_role" DEFAULT 'ETUDIANT' NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"prompt" text NOT NULL,
	"code" text,
	"code_language" "code_language",
	"options" jsonb NOT NULL,
	"explanation" text,
	"default_points" numeric(6, 2) DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"chapter_id" uuid,
	"author_id" uuid,
	"type" "question_type" NOT NULL,
	"difficulty" "difficulty" DEFAULT 'MOYENNE' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"suggested_duration_sec" integer DEFAULT 45 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_groups" (
	"exam_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "exam_groups_exam_id_group_id_pk" PRIMARY KEY("exam_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"question_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"duration_sec" integer NOT NULL,
	"points" numeric(6, 2) DEFAULT 1 NOT NULL,
	"neutralized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL,
	"module_id" uuid,
	"author_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "exam_status" DEFAULT 'BROUILLON' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"access_code" text,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"is_practice" boolean DEFAULT false NOT NULL,
	"violation_policy" jsonb DEFAULT '["AVERTISSEMENT","INVALIDER_QUESTION","SOUMISSION_AUTO"]'::jsonb NOT NULL,
	"security_settings" jsonb DEFAULT '{"answerToleranceSec":3,"heartbeatIntervalSec":10,"maxNetworkNeutralizations":1,"eventMergeWindowMs":2000,"blockCopyPaste":true,"shuffleAnswers":true}'::jsonb NOT NULL,
	"result_visibility" "result_visibility" DEFAULT 'NOTE' NOT NULL,
	"result_release_mode" "result_release_mode" DEFAULT 'MANUEL' NOT NULL,
	"results_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"exam_question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"option_order" jsonb NOT NULL,
	"status" "attempt_question_status" DEFAULT 'A_VENIR' NOT NULL,
	"shown_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"selected_option_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_correct" boolean,
	"points_awarded" numeric(6, 2)
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" "attempt_status" DEFAULT 'EN_COURS' NOT NULL,
	"current_position" integer DEFAULT 0 NOT NULL,
	"time_multiplier" numeric(4, 2) DEFAULT 1 NOT NULL,
	"violation_count" integer DEFAULT 0 NOT NULL,
	"network_neutralizations" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"score_awarded" numeric(8, 2),
	"score_max" numeric(8, 2),
	"score_out_of_20" numeric(5, 2),
	"receipt_code" text,
	"flagged_for_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_receipt_code_unique" UNIQUE("receipt_code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"attempt_question_id" uuid,
	"violation_number" integer NOT NULL,
	"sanction" "sanction_type" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"attempt_question_id" uuid,
	"incident_id" uuid,
	"type" "security_event_type" NOT NULL,
	"client_at" timestamp with time zone,
	"server_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_groups" ADD CONSTRAINT "exam_groups_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_groups" ADD CONSTRAINT "exam_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_version_id_question_versions_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_exam_question_id_exam_questions_id_fk" FOREIGN KEY ("exam_question_id") REFERENCES "public"."exam_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_attempt_question_id_attempt_questions_id_fk" FOREIGN KEY ("attempt_question_id") REFERENCES "public"."attempt_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_revoked_by_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_attempt_question_id_attempt_questions_id_fk" FOREIGN KEY ("attempt_question_id") REFERENCES "public"."attempt_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chapters_module_idx" ON "chapters" USING btree ("module_id","position");--> statement-breakpoint
CREATE INDEX "group_members_profile_idx" ON "group_members" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_name_uq" ON "groups" USING btree ("establishment_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_code_uq" ON "modules" USING btree ("establishment_id","code");--> statement-breakpoint
CREATE INDEX "profiles_establishment_idx" ON "profiles" USING btree ("establishment_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "question_versions_uq" ON "question_versions" USING btree ("question_id","version");--> statement-breakpoint
CREATE INDEX "questions_filter_idx" ON "questions" USING btree ("establishment_id","module_id","chapter_id","type","difficulty");--> statement-breakpoint
CREATE INDEX "exam_groups_group_idx" ON "exam_groups" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_questions_position_uq" ON "exam_questions" USING btree ("exam_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_questions_version_uq" ON "exam_questions" USING btree ("exam_id","question_version_id");--> statement-breakpoint
CREATE INDEX "exams_establishment_status_idx" ON "exams" USING btree ("establishment_id","status","opens_at");--> statement-breakpoint
CREATE UNIQUE INDEX "exams_access_code_uq" ON "exams" USING btree ("establishment_id","access_code");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_questions_position_uq" ON "attempt_questions" USING btree ("attempt_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_questions_question_uq" ON "attempt_questions" USING btree ("attempt_id","exam_question_id");--> statement-breakpoint
CREATE INDEX "attempt_questions_exam_question_idx" ON "attempt_questions" USING btree ("exam_question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_student_number_uq" ON "attempts" USING btree ("exam_id","student_id","attempt_number");--> statement-breakpoint
CREATE INDEX "attempts_exam_status_idx" ON "attempts" USING btree ("exam_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_active_uq" ON "attempts" USING btree ("exam_id","student_id") WHERE "attempts"."status" = 'EN_COURS';--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "incidents_attempt_idx" ON "incidents" USING btree ("attempt_id","started_at");--> statement-breakpoint
CREATE INDEX "security_events_attempt_idx" ON "security_events" USING btree ("attempt_id","server_at");