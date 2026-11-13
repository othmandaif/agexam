import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { currentAcademicYear } from "@/domain/academic-year";
import { saveHomeworkStepAction } from "@/features/homework/server/actions";
import { getHomeworkForStaff } from "@/features/homework/server/queries";
import { ExerciseEditor } from "@/features/training/components/exercise-editor";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Nouvelle étape" };

const STARTER = `ALGORITHME MonAlgo
VARIABLES
  n : ENTIER
DEBUT
  
FIN`;

/** Modèle de consigne selon la place de l'étape dans le problème. */
const HINTS = [
  "Étape 1 — Analyser : quelles sont les entrées (ce qu'on lit) et les sorties (ce qu'on affiche) ? Déclarez les variables et affichez-les.",
  "Étape 2 — Lire les données : lisez les entrées avec LIRE puis affichez-les pour vérifier.",
  "Étape 3 — Calculer : ajoutez le calcul et affichez le résultat intermédiaire.",
  "Étape 4 — Algorithme complet : assemblez tout et affichez le résultat final demandé.",
];

export default async function NewHomeworkStepPage({
  params,
}: {
  params: Promise<{ homeworkId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { homeworkId } = await params;
  if (!z.uuid().safeParse(homeworkId).success) notFound();
  const { homework, steps } = await getHomeworkForStaff(
    user.establishmentId,
    homeworkId,
    viewerOf(user),
  ).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  if (homework.academicYear !== currentAcademicYear()) notFound();
  const stepNo = (steps.at(-1)?.stepNo ?? 0) + 1;

  return (
    <>
      <PageHeader
        back={{ href: paths.homework(homework.id), label: homework.title }}
        icon={<FilePlus2 />}
        title={`Nouvelle étape (${stepNo})`}
      />
      <ExerciseEditor
        trackId={homework.id}
        readOnly={false}
        saveAction={saveHomeworkStepAction}
        levelLabel="Étape n°"
        noun="l'étape"
        withHint
        initial={{
          level: stepNo,
          title: "",
          statement: HINTS[Math.min(stepNo, HINTS.length) - 1] ?? "",
          starterCode: STARTER,
          solutionCode: STARTER,
          tests: [],
        }}
      />
    </>
  );
}
