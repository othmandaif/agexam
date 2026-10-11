import { Radio } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { syncExamAttempts } from "@/features/attempts/server/engine";
import { getManageableExam } from "@/features/exams/server/service";
import { MonitorBoard } from "@/features/monitoring/client/monitor-board";
import { getMonitorData } from "@/features/monitoring/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Suivi en direct" };

export default async function LiveMonitoringPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { examId } = await params;
  if (!z.uuid().safeParse(examId).success) notFound();

  try {
    await getManageableExam(user, examId);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  await syncExamAttempts(examId);
  const data = await getMonitorData(examId);

  return (
    <>
      <PageHeader
        icon={<Radio aria-hidden />}
        back={{ href: paths.exam(examId), label: data.exam.title }}
        title="Suivi en direct"
        description="Mise à jour automatique toutes les 4 secondes. Les étudiants à surveiller remontent en haut."
      />
      <MonitorBoard initialData={data} />
    </>
  );
}
