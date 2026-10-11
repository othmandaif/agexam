ALTER TABLE "questions" ADD COLUMN "origin_exam_id" uuid;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "source_text" text;--> statement-breakpoint
CREATE INDEX "questions_origin_exam_idx" ON "questions" USING btree ("origin_exam_id");