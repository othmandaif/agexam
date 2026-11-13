import { FileCode2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { currentAcademicYear } from "@/domain/academic-year";
import {
  deleteHomeworkStepAction,
  saveHomeworkStepAction,
} from "@/features/homework/server/actions";
import { getStepForStaff } from "@/features/homework/server/queries";
import {
  DeleteExerciseButton,
  ExerciseEditor,
} from "@/features/training/components/exercise-editor";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Étape du devoir" };

export default async function HomeworkStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeworkId: string; stepId: string }>;
  searchParams: Promise<{ cree?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { homeworkId, stepId } = await params;
  const { cree } = await searchParams;
  if (!z.uuid().safeParse(stepId).success) notFound();
  const { step, homework } = await getStepForStaff(
    user.establishmentId,
    stepId,
    viewerOf(user),
  ).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  if (homework.id !== homeworkId) notFound();
  const editable = homework.academicYear === currentAcademicYear();

  return (
    <>
      <PageHeader
        back={{ href: paths.homework(homework.id), label: homework.title }}
        icon={<FileCode2 />}
        title={step.title}
        eyebrow={`Étape ${step.stepNo}`}
        actions={
          editable ? (
            <DeleteExerciseButton
              exerciseId={step.id}
              title={step.title}
              deleteAction={deleteHomeworkStepAction}
              noun="cette étape"
            />
          ) : null
        }
      />
      {cree ? (
        <p
          role="status"
          className="rounded-xl bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          Étape créée : les sorties attendues ont été figées depuis le corrigé.
        </p>
      ) : null}
      <ExerciseEditor
        key={step.updatedAt.toISOString()}
        trackId={homework.id}
        readOnly={!editable}
        saveAction={saveHomeworkStepAction}
        levelLabel="Étape n°"
        noun="l'étape"
        withHint
        initial={{
          id: step.id,
          level: step.stepNo,
          title: step.title,
          statement: step.statement,
          starterCode: step.starterCode,
          solutionCode: step.solutionCode,
          tests: step.tests,
          hintCode: step.hintCode,
          hintInputs: step.hintInputs,
        }}
      />
    </>
  );
}
