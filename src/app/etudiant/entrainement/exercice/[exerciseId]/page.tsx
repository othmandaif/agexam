import { CheckCircle2, EyeOff, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/navigation/back-link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExerciseWorkspace } from "@/features/training/components/exercise-workspace";
import { getStudentExercise } from "@/features/training/server/queries";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Exercice" };

export default async function StudentExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const user = await requireTenant("ETUDIANT");
  const { exerciseId } = await params;
  if (!z.uuid().safeParse(exerciseId).success) notFound();
  let data;
  try {
    data = await getStudentExercise(user.id, user.establishmentId, exerciseId);
  } catch (e) {
    if (e instanceof AppError && e.code === "FORBIDDEN") {
      return (
        <Card>
          <EmptyState
            icon={Lock}
            title="Niveau verrouillé"
            description="Terminez tous les exercices du niveau précédent pour débloquer celui-ci."
            action={
              <Link
                href={ROUTES.student.training}
                className={buttonVariants({ variant: "primary" })}
              >
                Retour à l&apos;entraînement
              </Link>
            }
          />
        </Card>
      );
    }
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { exercise, track, solved, last, next } = data;

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink href={paths.studentTrack(track.id)}>{track.title}</BackLink>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[26px] leading-tight font-bold">{exercise.title}</h1>
          <Badge tone="info">Niveau {exercise.level}</Badge>
          {solved ? (
            <Badge tone="success">
              <CheckCircle2 aria-hidden /> Réussi
            </Badge>
          ) : null}
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
          {exercise.statement}
        </p>
        {exercise.examples.length ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold tracking-wide text-muted uppercase">Exemples</h2>
            <div className="grid gap-2.5 md:grid-cols-2">
              {exercise.examples.map((ex, i) => (
                <div key={i} className="overflow-hidden rounded-[10px] border border-line-soft">
                  <div className="border-b border-line-soft bg-canvas px-3 py-1.5 font-mono text-[12.5px] text-muted">
                    {ex.inputs.length ? `Saisies : ${ex.inputs.join(" · ")}` : "Sans saisie"}
                  </div>
                  <pre className="m-0 bg-[#0f172a] px-3 py-2 font-mono text-[12.5px] whitespace-pre-wrap text-[#e2e8f0]">
                    {ex.expected || "(aucune sortie)"}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {exercise.hiddenCount ? (
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <EyeOff className="size-3.5" aria-hidden /> + {exercise.hiddenCount} jeu
            {exercise.hiddenCount > 1 ? "x" : ""} d&apos;essai caché
            {exercise.hiddenCount > 1 ? "s" : ""} à la soumission.
          </p>
        ) : null}
      </Card>

      <ExerciseWorkspace
        exerciseId={exercise.id}
        initialCode={last?.code ?? exercise.starterCode}
        starterCode={exercise.starterCode}
        lastResult={
          last
            ? {
                passed: last.passed,
                passedCount: last.passedCount,
                totalCount: last.totalCount,
                results: last.results,
              }
            : null
        }
        next={next}
      />
    </>
  );
}
