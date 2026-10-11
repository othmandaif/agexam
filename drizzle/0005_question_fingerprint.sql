ALTER TABLE "question_versions" ADD COLUMN "fingerprint" text;--> statement-breakpoint
CREATE INDEX "question_versions_fingerprint_idx" ON "question_versions" USING btree ("fingerprint");--> statement-breakpoint
-- Empreintes des versions existantes : même texte canonique que domain/question-fingerprint.ts
-- (champs séparés par chr(31), options « bonne(0/1) fixe(0/1) libellé »).
UPDATE "question_versions" AS qv
SET "fingerprint" = md5(concat_ws(chr(31),
  qv."prompt",
  coalesce(qv."code", ''),
  coalesce(qv."code_language"::text, ''),
  coalesce(qv."explanation", ''),
  (
    SELECT string_agg(
      (CASE WHEN coalesce((o.value->>'isCorrect')::boolean, false) THEN '1' ELSE '0' END)
      || (CASE WHEN coalesce((o.value->>'fixedPosition')::boolean, false) THEN '1' ELSE '0' END)
      || (o.value->>'label'),
      chr(31) ORDER BY o.ordinality
    )
    FROM jsonb_array_elements(qv."options") WITH ORDINALITY AS o(value, ordinality)
  )
))
WHERE qv."fingerprint" IS NULL;
