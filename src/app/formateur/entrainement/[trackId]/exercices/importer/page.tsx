import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { currentAcademicYear } from "@/domain/academic-year";
import { ExerciseImport } from "@/features/training/components/exercise-import";
import { getTrackForStaff } from "@/features/training/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Importer des exercices" };

export default async function ImportExercisesPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { trackId } = await params;
  if (!z.uuid().safeParse(trackId).success) notFound();
  const { track } = await getTrackForStaff(user.establishmentId, trackId).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  if (track.academicYear !== currentAcademicYear()) notFound();
  return (
    <>
      <PageHeader
        back={{ href: paths.track(track.id), label: track.title }}
        icon={<Upload />}
        title="Importer des exercices"
        description="Tous les exercices d'un coup, depuis un modèle texte : énoncé, corrigé et jeux d'essai. Les sorties attendues sont figées depuis chaque corrigé."
      />
      <ExerciseImport trackId={track.id} />
    </>
  );
}
