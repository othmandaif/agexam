import { z } from "zod";
import { getManageableExam } from "@/features/exams/server/service";
import { fileSlug, getExportMeta } from "@/features/results/server/export-meta";
import { buildResultsPdf } from "@/features/results/server/pdf";
import { getExamResults } from "@/features/results/server/queries";
import { filterStudents, STUDENT_STATUS_FILTERS } from "@/features/results/students-filter";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";
import { errors } from "@/server/http/errors";

export const runtime = "nodejs";

/**
 * Grille des résultats en PDF (A4 paysage). Reprend les filtres de la page
 * (?q=&statut=) et exporte toutes les lignes filtrées, pas seulement la page visible.
 */
export const GET = apiRoute<{ examId: string }>(async (req, { params }) => {
  const staff = await requireApiTenant("FORMATEUR", "ADMIN");
  const { examId } = z.object({ examId: z.uuid() }).parse(await params);
  await getManageableExam(staff, examId);
  const [results, meta] = await Promise.all([getExamResults(examId), getExportMeta(examId)]);
  if (!results) throw errors.notFound("Examen introuvable.");

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const statut = url.searchParams.get("statut") ?? "";
  // Ordre alphabétique : document officiel (le classement reste visible via la note).
  const students = filterStudents(results.students, { q, statut }).sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "fr"),
  );
  const filterLabel =
    [
      statut in STUDENT_STATUS_FILTERS
        ? STUDENT_STATUS_FILTERS[statut as keyof typeof STUDENT_STATUS_FILTERS]
        : null,
      q ? `« ${q} »` : null,
    ]
      .filter(Boolean)
      .join(", ") || null;

  const pdf = await buildResultsPdf(results, meta, students, filterLabel);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resultats-${fileSlug(results.exam.title)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
