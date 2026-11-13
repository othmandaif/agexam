import { FileCheck2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TracePlayer } from "@/features/homework/components/trace-player";
import { getHandinForStaff, getHomeworkForStaff } from "@/features/homework/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Rendu du devoir" };

export default async function HandinPage({
  params,
}: {
  params: Promise<{ homeworkId: string; studentId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { homeworkId, studentId } = await params;
  if (!z.uuid().safeParse(homeworkId).success || !z.uuid().safeParse(studentId).success) {
    notFound();
  }
  const { homework } = await getHomeworkForStaff(
    user.establishmentId,
    homeworkId,
    viewerOf(user),
  ).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const handin = await getHandinForStaff(homeworkId, studentId);
  if (!handin) notFound();

  return (
    <>
      <PageHeader
        back={{ href: paths.homework(homework.id), label: homework.title }}
        icon={<FileCheck2 />}
        title={handin.fullName}
        eyebrow={
          <span className="flex items-center gap-2">
            <Badge tone={handin.isLate ? "warning" : "success"}>
              {handin.isLate ? "Rendu en retard" : "Rendu"}
            </Badge>
            le {formatDateTime(new Date(handin.submittedAt))}
          </span>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Algorithme rendu et sa trace</CardTitle>
          <CardDescription>
            Rejouez l&apos;exécution pas à pas : la trace a été enregistrée au moment du rendu, sur
            le premier exemple de la dernière étape.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TracePlayer code={handin.code} frames={handin.trace} />
        </CardContent>
      </Card>
    </>
  );
}
