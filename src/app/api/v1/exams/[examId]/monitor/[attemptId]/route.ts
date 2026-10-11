import { z } from "zod";
import { getManageableExam } from "@/features/exams/server/service";
import { getAttemptTimeline } from "@/features/monitoring/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok } from "@/server/http/api";
import { errors } from "@/server/http/errors";

/** Journal des événements d'une tentative. */
export const GET = apiRoute<{ examId: string; attemptId: string }>(async (_req, { params }) => {
  const staff = await requireApiTenant("FORMATEUR", "ADMIN");
  const { examId, attemptId } = z
    .object({ examId: z.uuid(), attemptId: z.uuid() })
    .parse(await params);
  await getManageableExam(staff, examId);
  const timeline = await getAttemptTimeline(examId, attemptId);
  if (!timeline) throw errors.notFound("Tentative introuvable.");
  return ok(timeline);
});
