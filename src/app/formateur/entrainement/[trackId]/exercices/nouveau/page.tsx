import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { currentAcademicYear } from "@/domain/academic-year";
import { ExerciseEditor } from "@/features/training/components/exercise-editor";
import { getTrackForStaff } from "@/features/training/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Nouvel exercice" };

const STARTER = `ALGORITHME MonAlgo
VARIABLES
  n : ENTIER
DEBUT
  
FIN`;

export default async function NewExercisePage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { trackId } = await params;
  if (!z.uuid().safeParse(trackId).success) notFound();
  const { track, exercises } = await getTrackForStaff(user.establishmentId, trackId).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  if (track.academicYear !== currentAcademicYear()) notFound();
  const lastLevel = exercises.at(-1)?.level ?? 1;

  return (
    <>
      <PageHeader
        back={{ href: paths.track(track.id), label: track.title }}
        icon={<FilePlus2 />}
        title="Nouvel exercice"
      />
      <ExerciseEditor
        trackId={track.id}
        readOnly={false}
        initial={{
          level: lastLevel,
          title: "",
          statement: "",
          starterCode: STARTER,
          solutionCode: STARTER,
          tests: [],
        }}
      />
    </>
  );
}
