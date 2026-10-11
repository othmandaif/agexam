import { saveAnswer } from "@/features/attempts/server/engine";
import { answerSchema, attemptParamsSchema, attemptSessionFrom } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok, parseBody } from "@/server/http/api";

/** Enregistre la sélection de la question en cours (appelé à chaque clic). */
export const PUT = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  const body = await parseBody(req, answerSchema);
  return ok(await saveAnswer(student, attemptId, body, attemptSessionFrom(req)));
});
