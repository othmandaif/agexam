import { continuePractice } from "@/features/attempts/server/engine";
import { attemptParamsSchema, attemptSessionFrom } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok } from "@/server/http/api";

/** Entraînement : correction lue, démarre la question suivante (son chrono part maintenant). */
export const POST = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  return ok(await continuePractice(student, attemptId, attemptSessionFrom(req)));
});
