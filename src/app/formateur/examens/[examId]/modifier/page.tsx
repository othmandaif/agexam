import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { canEditContent } from "@/domain/exam-lifecycle";
import { ExamEditor } from "@/features/exams/components/exam-editor";
import { toEditorInitial } from "@/features/exams/server/editor-data";
import { getEditorOptions, getExamDetail } from "@/features/exams/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Modifier l'examen" };

export default async function EditExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { examId } = await params;
  if (!z.uuid().safeParse(examId).success) notFound();

  const [exam, options] = await Promise.all([
    getExamDetail(user, examId),
    getEditorOptions(user.establishmentId, viewerOf(user)),
  ]);
  if (!exam) notFound();

  return (
    <>
      <PageHeader
        icon={<Pencil aria-hidden />}
        back={{ href: paths.exam(exam.id), label: exam.title }}
        title="Modifier l'examen"
      />
      <ExamEditor
        exam={toEditorInitial(exam)}
        modules={options.modules}
        groups={options.groups}
        contentLocked={!canEditContent(exam.attemptCount)}
        isAdmin={user.role === "ADMIN"}
      />
    </>
  );
}
