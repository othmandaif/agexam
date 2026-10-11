import { z } from "zod";
import { getManageableExam } from "@/features/exams/server/service";
import { buildResultsWorkbook } from "@/features/results/server/export";
import { getExamResults } from "@/features/results/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";
import { errors } from "@/server/http/errors";

/** Export Excel des résultats (synthèse, notes, questions, grille). */
export const GET = apiRoute<{ examId: string }>(async (_req, { params }) => {
  const staff = await requireApiTenant("FORMATEUR", "ADMIN");
  const { examId } = z.object({ examId: z.uuid() }).parse(await params);
  await getManageableExam(staff, examId);
  const results = await getExamResults(examId);
  if (!results) throw errors.notFound("Examen introuvable.");
  const buffer = await buildResultsWorkbook(results);
  const slug =
    results.exam.title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "examen";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resultats-${slug}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
