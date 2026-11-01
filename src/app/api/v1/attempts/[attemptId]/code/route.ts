import { saveCode } from "@/features/attempts/server/engine";
import { attemptParamsSchema, attemptSessionFrom, codeSchema } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok, parseBody } from "@/server/http/api";

/** Enregistre l'algorithme en cours de la question (sauvegarde régulière). */
export const PUT = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  const body = await parseBody(req, codeSchema);
  return ok(await saveCode(student, attemptId, body, attemptSessionFrom(req)));
});
