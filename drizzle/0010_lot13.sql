CREATE TABLE IF NOT EXISTS "exam_candidates" (
	"exam_id" uuid NOT NULL REFERENCES "public"."exams"("id") ON DELETE cascade,
	"profile_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE cascade,
	CONSTRAINT "exam_candidates_exam_id_profile_id_pk" PRIMARY KEY("exam_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "exam_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "exam_candidates" FROM anon, authenticated;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_candidates_profile_idx" ON "exam_candidates" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "security_settings" SET DEFAULT '{"answerToleranceSec":3,"heartbeatIntervalSec":10,"maxNetworkNeutralizations":1,"maxNetworkPauseSec":600,"eventMergeWindowMs":2000,"blockCopyPaste":true,"shuffleAnswers":true}'::jsonb;
