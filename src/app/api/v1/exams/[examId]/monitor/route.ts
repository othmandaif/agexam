import { z } from "zod";
import { syncExamAttempts } from "@/features/attempts/server/engine";
import { getManageableExam } from "@/features/exams/server/service";
import { getMonitorData } from "@/features/monitoring/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok } from "@/server/http/api";

/** Données du suivi en direct (interrogé toutes les quelques secondes par l'écran formateur). */
export const GET = apiRoute<{ examId: string }>(async (_req, { params }) => {
  const staff = await requireApiTenant("FORMATEUR", "ADMIN");
  const { examId } = z.object({ examId: z.uuid() }).parse(await params);
  await getManageableExam(staff, examId);
  await syncExamAttempts(examId);
  return ok(await getMonitorData(examId));
});
