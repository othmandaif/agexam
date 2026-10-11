import { nextQuestion } from "@/features/attempts/server/engine";
import { answerSchema, attemptParamsSchema, attemptSessionFrom } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok, parseBody } from "@/server/http/api";

/** Valide la question en cours (avec la sélection finale) et passe à la suivante. */
export const POST = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  const body = await parseBody(req, answerSchema);
  return ok(await nextQuestion(student, attemptId, body, attemptSessionFrom(req)));
});
