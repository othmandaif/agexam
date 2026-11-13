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
import { Statement } from "@/features/homework/components/statement";
import { VisualHint } from "@/features/homework/components/visual-hint";
import { submitHomeworkStepAction } from "@/features/homework/server/actions";
import {
  getStepHintFrames,
  getStudentStep,
  lastPassingCode,
} from "@/features/homework/server/queries";
import { ExerciseWorkspace } from "@/features/training/components/exercise-workspace";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Étape du devoir" };

/** Point de départ quand l'étape n'a pas de code de départ. */
const SKELETON = `VARIABLES

DEBUT

FIN`;

export default async function StudentHomeworkStepPage({
  params,
}: {
  params: Promise<{ stepId: string }>;
}) {
  const user = await requireTenant("ETUDIANT");
  const { stepId } = await params;
  if (!z.uuid().safeParse(stepId).success) notFound();
  let data;
  try {
    data = await getStudentStep(user.id, user.establishmentId, stepId);
  } catch (e) {
    if (e instanceof AppError && e.code === "FORBIDDEN") {
      return (
        <Card>
          <EmptyState
            icon={Lock}
            title="Étape verrouillée"
            description="Réussissez tous les tests de l'étape précédente pour ouvrir celle-ci."
            action={
              <Link
                href={ROUTES.student.homework}
                className={buttonVariants({ variant: "primary" })}
              >
                Retour aux devoirs
              </Link>
            }
          />
        </Card>
      );
    }
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { step, homework, total, passed, isLast, last, next, previousId } = data;
  // On continue sur le code de l'étape précédente réussie (sauf code de départ imposé).
  const carried =
    !last && previousId && !step.starterCode.trim()
      ? await lastPassingCode(user.id, previousId)
      : null;
  const hint = await getStepHintFrames(step.id);
  const initialCode =
    last?.code ?? carried ?? (step.starterCode.trim() ? step.starterCode : SKELETON);

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink href={paths.studentHomework(homework.id)}>{homework.title}</BackLink>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[26px] leading-tight font-bold">{step.title}</h1>
          <Badge tone="info">
            Étape {step.index} / {total}
          </Badge>
          {passed ? (
            <Badge tone="success">
              <CheckCircle2 aria-hidden /> Réussie
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={
                i < step.index - 1 || (i === step.index - 1 && passed)
                  ? "h-1.5 flex-1 rounded-full bg-success"
                  : i === step.index - 1
                    ? "h-1.5 flex-1 rounded-full bg-primary"
                    : "h-1.5 flex-1 rounded-full bg-line"
              }
            />
          ))}
        </div>
      </div>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold tracking-wide text-muted uppercase">Consigne</h2>
          <Statement text={step.statement} />
        </div>
        {step.examples.length ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold tracking-wide text-muted uppercase">
              Résultat attendu
            </h2>
            <div className="grid gap-2.5 md:grid-cols-2">
              {step.examples.map((ex, i) => (
                <div key={i} className="overflow-hidden rounded-[12px] border border-line">
                  <div className="border-b border-line bg-canvas px-3.5 py-2 text-[12.5px] font-semibold text-muted">
                    {ex.inputs.length ? (
                      <>
                        Saisies :{" "}
                        <span className="font-mono text-ink">{ex.inputs.join(" · ")}</span>
                      </>
                    ) : (
                      "Sans saisie"
                    )}
                  </div>
                  <pre className="m-0 bg-[#0f172a] px-3.5 py-2.5 font-mono text-[13px] whitespace-pre-wrap text-[#e2e8f0]">
                    {ex.expected || "(aucune sortie)"}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {step.hiddenCount ? (
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <EyeOff className="size-3.5" aria-hidden /> + {step.hiddenCount} jeu
            {step.hiddenCount > 1 ? "x" : ""} d&apos;essai caché
            {step.hiddenCount > 1 ? "s" : ""} à la soumission.
          </p>
        ) : null}
      </Card>

      {hint ? <VisualHint stepId={step.id} frames={hint.frames} inputs={hint.inputs} /> : null}

      <ExerciseWorkspace
        exerciseId={step.id}
        initialCode={initialCode}
        starterCode={step.starterCode || initialCode}
        submitAction={submitHomeworkStepAction}
        nextHref={next ? paths.studentHomeworkStep(next.id) : undefined}
        labels={{
          solved: isLast
            ? "Dernière étape réussie ! Vous pouvez rendre le devoir."
            : "Étape réussie !",
          unlocked: "Étape suivante débloquée",
          next: "Étape suivante",
        }}
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

      {isLast ? (
        <Link
          href={paths.studentHomework(homework.id)}
          className={buttonVariants({ variant: "outline", className: "self-start" })}
        >
          Aller au rendu final
        </Link>
      ) : null}
    </>
  );
}
