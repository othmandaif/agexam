import { z } from "zod";
import { getManageableExam } from "@/features/exams/server/service";
import { buildEvaluationGrid } from "@/features/results/server/export";
import { fileSlug, getExportMeta } from "@/features/results/server/export-meta";
import { getExamResults } from "@/features/results/server/queries";
import { filterStudents } from "@/features/results/students-filter";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";
import { errors } from "@/server/http/errors";

/**
 * Grille d'évaluation compacte (une feuille Excel, paysage). Reprend les
 * filtres de la page résultats (?q=&statut=) sur toutes les lignes.
 */
export const GET = apiRoute<{ examId: string }>(async (req, { params }) => {
  const staff = await requireApiTenant("FORMATEUR", "ADMIN");
  const { examId } = z.object({ examId: z.uuid() }).parse(await params);
  await getManageableExam(staff, examId);
  const [results, meta] = await Promise.all([getExamResults(examId), getExportMeta(examId)]);
  if (!results) throw errors.notFound("Examen introuvable.");
  const url = new URL(req.url);
  const list = filterStudents(results.students, {
    q: (url.searchParams.get("q") ?? "").trim().slice(0, 100),
    statut: url.searchParams.get("statut") ?? "",
  });
  const buffer = await buildEvaluationGrid(results, meta, list);
  const slug = fileSlug(results.exam.title);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="grille-${slug}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
