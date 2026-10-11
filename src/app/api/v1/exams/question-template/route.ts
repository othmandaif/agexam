import { buildQuestionTemplate } from "@/features/exams/server/question-files";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";

/** Modèle Excel pour importer des questions. */
export const GET = apiRoute(async () => {
  await requireApiTenant("FORMATEUR", "ADMIN");
  const buffer = await buildQuestionTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-questions-agexam.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
