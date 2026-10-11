import { z } from "zod";
import { getManageableExam } from "@/features/exams/server/service";
import { fileSlug, getExportMeta } from "@/features/results/server/export-meta";
import { buildCopyPdf } from "@/features/results/server/pdf";
import { getExamResults, getStudentCopy } from "@/features/results/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";
import { errors } from "@/server/http/errors";

export const runtime = "nodejs";

/**
 * Copie individuelle en PDF, avec le corrigé : réservée au formateur de
 * l'examen et à l'administration (jamais servie à un étudiant).
 */
export const GET = apiRoute<{ examId: string; attemptId: string }>(async (_req, { params }) => {
  const staff = await requireApiTenant("FORMATEUR", "ADMIN");
  const { examId, attemptId } = z
    .object({ examId: z.uuid(), attemptId: z.uuid() })
    .parse(await params);
  await getManageableExam(staff, examId);
  const [copy, results, meta] = await Promise.all([
    getStudentCopy(examId, attemptId),
    getExamResults(examId),
    getExportMeta(examId),
  ]);
  if (!copy || !results) throw errors.notFound("Copie introuvable.");
  if (copy.status === "EN_COURS") throw errors.conflict("La copie est encore en cours.");
  const groups = results.students.find((s) => s.profileId === copy.student.id)?.groups ?? "";

  const pdf = await buildCopyPdf(copy, meta, groups, results.exam.bonusPoints);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="copie-${fileSlug(copy.student.fullName, "etudiant")}-${fileSlug(copy.examTitle)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
