import { Download, FileCheck2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { PrintButton } from "@/features/attempts/client/print-button";
import { getManageableExam } from "@/features/exams/server/service";
import { getAttemptTimeline } from "@/features/monitoring/server/queries";
import { StudentCopyView } from "@/features/results/components/student-copy";
import { getStudentCopy } from "@/features/results/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Copie" };

export default async function CopyPage({
  params,
}: {
  params: Promise<{ examId: string; attemptId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { examId, attemptId } = await params;
  if (!z.uuid().safeParse(examId).success || !z.uuid().safeParse(attemptId).success) notFound();
  try {
    await getManageableExam(user, examId);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  const [copy, timeline] = await Promise.all([
    getStudentCopy(examId, attemptId),
    getAttemptTimeline(examId, attemptId),
  ]);
  if (!copy) notFound();

  return (
    <>
      <PageHeader
        icon={<FileCheck2 aria-hidden />}
        back={{ href: paths.examResults(examId), label: "Résultats" }}
        title={copy.student.fullName}
        description={`${copy.student.email} · ${copy.examTitle}${copy.attemptNumber > 1 ? ` · tentative ${copy.attemptNumber}` : ""}`}
        actions={
          <>
            {copy.status !== "EN_COURS" ? (
              <a
                href={paths.examCopyPdf(examId, attemptId)}
                download
                className={buttonVariants({ variant: "mint" })}
              >
                <Download aria-hidden /> Copie PDF
              </a>
            ) : null}
            <PrintButton label="Imprimer la copie" />
          </>
        }
      />

      {copy.status === "EN_COURS" ||
      copy.questions.some(
        (q) => q.algo?.grading && ["pending", "running"].includes(q.algo.grading.status),
      ) ? (
        <div className="flex justify-end">
          <LiveRefresh
            intervalSec={copy.status === "EN_COURS" ? 15 : 6}
            label={
              copy.status === "EN_COURS" ? "Copie en cours, suivi en direct" : "Correction en cours"
            }
          />
        </div>
      ) : null}
      <StudentCopyView copy={copy} timeline={timeline} />
    </>
  );
}
