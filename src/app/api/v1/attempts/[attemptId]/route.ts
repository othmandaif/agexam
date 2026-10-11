import { getAttemptState } from "@/features/attempts/server/engine";
import { listHelp } from "@/features/attempts/server/help";
import { attemptParamsSchema, attemptSessionFrom } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok } from "@/server/http/api";

/**
 * État de la tentative. Sert aussi de signal de présence (heartbeat) :
 * chaque appel rattrape le temps écoulé et note le dernier signe de vie.
 */
export const GET = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  const state = await getAttemptState(student, attemptId, attemptSessionFrom(req));
  // Réponses du formateur aux questions de l'étudiant (seulement avec la présence).
  return ok({ ...state, help: await listHelp(attemptId) });
});
