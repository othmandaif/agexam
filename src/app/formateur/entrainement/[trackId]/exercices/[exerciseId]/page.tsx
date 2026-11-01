import { FileCode2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { currentAcademicYear } from "@/domain/academic-year";
import {
  DeleteExerciseButton,
  ExerciseEditor,
} from "@/features/training/components/exercise-editor";
import { getExerciseForStaff } from "@/features/training/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Exercice" };

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ trackId: string; exerciseId: string }>;
  searchParams: Promise<{ cree?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { trackId, exerciseId } = await params;
  const { cree } = await searchParams;
  if (!z.uuid().safeParse(exerciseId).success) notFound();
  const { exercise, track } = await getExerciseForStaff(user.establishmentId, exerciseId).catch(
    (e) => {
      if (e instanceof AppError) notFound();
      throw e;
    },
  );
  if (track.id !== trackId) notFound();
  const editable = track.academicYear === currentAcademicYear();

  return (
    <>
      <PageHeader
        back={{ href: paths.track(track.id), label: track.title }}
        icon={<FileCode2 />}
        title={exercise.title}
        eyebrow={`Niveau ${exercise.level}`}
        actions={
          editable ? <DeleteExerciseButton exerciseId={exercise.id} title={exercise.title} /> : null
        }
      />
      {cree ? (
        <p
          role="status"
          className="rounded-xl bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          Exercice créé : les sorties attendues ont été figées depuis le corrigé.
        </p>
      ) : null}
      <ExerciseEditor
        key={exercise.updatedAt.toISOString()}
        trackId={track.id}
        readOnly={!editable}
        initial={{
          id: exercise.id,
          level: exercise.level,
          title: exercise.title,
          statement: exercise.statement,
          starterCode: exercise.starterCode,
          solutionCode: exercise.solutionCode,
          tests: exercise.tests,
        }}
      />
    </>
  );
}
