import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { z } from "zod";
import { getBankQuestionsByIds } from "@/features/bank/server/queries";
import { bankQuestionsToText } from "@/features/bank/text";
import { ExamEditor } from "@/features/exams/components/exam-editor";
import { getEditorOptions } from "@/features/exams/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Nouvel examen" };

export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{ questions?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { questions: ids } = await searchParams;
  const questionIds = (ids ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success)
    .slice(0, 60);
  const [options, fromBank] = await Promise.all([
    getEditorOptions(user.establishmentId, viewerOf(user)),
    getBankQuestionsByIds(user, questionIds),
  ]);
  const modulesUsed = [...new Set(fromBank.map((q) => q.moduleId))];
  const prefill = fromBank.length
    ? {
        sourceText: `${bankQuestionsToText(fromBank)}\n`,
        moduleId: modulesUsed.length === 1 ? modulesUsed[0]! : null,
      }
    : undefined;

  return (
    <>
      <PageHeader
        icon={<FilePlus2 aria-hidden />}
        back={{ href: ROUTES.trainer.exams, label: "Examens" }}
        title="Nouvel examen"
        description={
          prefill
            ? `${fromBank.length} question${fromBank.length > 1 ? "s" : ""} de la banque ajoutée${fromBank.length > 1 ? "s" : ""}. Complétez les informations puis enregistrez.`
            : "Informations, questions et durées sur une seule page. Enregistrez en brouillon à tout moment."
        }
      />
      <ExamEditor
        modules={options.modules}
        groups={options.groups}
        isAdmin={user.role === "ADMIN"}
        prefill={prefill}
      />
    </>
  );
}
