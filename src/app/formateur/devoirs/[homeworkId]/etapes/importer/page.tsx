import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { currentAcademicYear } from "@/domain/academic-year";
import { importHomeworkStepsAction } from "@/features/homework/server/actions";
import { getHomeworkForStaff } from "@/features/homework/server/queries";
import { ExerciseImport } from "@/features/training/components/exercise-import";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Importer des étapes" };

export default async function ImportHomeworkStepsPage({
  params,
}: {
  params: Promise<{ homeworkId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { homeworkId } = await params;
  if (!z.uuid().safeParse(homeworkId).success) notFound();
  const { homework } = await getHomeworkForStaff(
    user.establishmentId,
    homeworkId,
    viewerOf(user),
  ).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  if (homework.academicYear !== currentAcademicYear()) notFound();
  return (
    <>
      <PageHeader
        back={{ href: paths.homework(homework.id), label: homework.title }}
        icon={<Upload />}
        title="Importer les étapes"
        description="Toutes les étapes d'un coup, depuis un modèle texte : énoncé, corrigé et jeux d'essai. Les sorties attendues sont figées depuis chaque corrigé ; le corrigé sert aussi à l'indice animé."
      />
      <ExerciseImport trackId={homework.id} importAction={importHomeworkStepsAction} homework />
    </>
  );
}
