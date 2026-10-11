import { recordEvents } from "@/features/attempts/server/engine";
import { attemptParamsSchema, attemptSessionFrom, eventsSchema } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok, parseBody } from "@/server/http/api";

/** Événements du navigateur (plein écran, onglet, focus, rechargement…). */
export const POST = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  const { events } = await parseBody(req, eventsSchema);
  return ok(await recordEvents(student, attemptId, events, attemptSessionFrom(req)));
});
