import { Check, CircleCheck, Hourglass, LoaderCircle, Lock, X } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { FreeAnswer } from "@/components/exam/free-answer";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { CodeBlock } from "@/components/exam/code-block";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttemptStatus } from "@/domain/enums";
import { PASS_MARK } from "@/domain/statistics";
import { PrintButton } from "@/features/attempts/client/print-button";
import { scheduleAlgoGrading } from "@/features/attempts/server/algo-grader";
import { syncAttemptIfActive } from "@/features/attempts/server/engine";
import { getStudentResult } from "@/features/attempts/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Reçu et résultat" };

const STATUS_TEXT: Partial<Record<AttemptStatus, string>> = {
  SOUMISE: "Examen soumis",
  SOUMISE_AUTO: "Examen soumis automatiquement",
  EXPIREE: "Examen terminé à la fermeture",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-soft py-3 text-[15px] last:border-b-0">
      <span className="text-muted">{label}</span>
      <strong className="text-right">{children}</strong>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={cn("flex flex-[1_1_110px] flex-col gap-1 rounded-xl p-4", tone)}>
      <span className="font-display text-2xl font-bold">{value}</span>
      <span className="text-[13px] font-bold">{label}</span>
    </div>
  );
}

export default async function StudentResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const student = await requireTenant("ETUDIANT");
  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) notFound();

  try {
    const status = await syncAttemptIfActive(student, attemptId);
    if (status === "EN_COURS") redirect(`/examen/${attemptId}` as Route);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const result = await getStudentResult(student, attemptId);
  if (!result) notFound();
  const { receipt, score, counts, correction, level } = result;
  // Correction d'algorithme restée en attente : relancée en arrière-plan.
  if (result.gradingPending) scheduleAlgoGrading(attemptId);
  const pct = score?.outOf20 != null ? Math.max(0, Math.min(100, (score.outOf20 / 20) * 100)) : 0;
  const passed = score?.outOf20 != null && score.outOf20 >= PASS_MARK;
  const ring = passed ? "var(--color-mint-strong)" : "var(--color-warning-fill)";

  return (
    <>
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[1_1_380px]">
          <CardContent className="flex flex-col gap-5 pt-8">
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-mint text-mint-ink">
                <Check className="size-8" strokeWidth={2.6} aria-hidden />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {STATUS_TEXT[receipt.status] ?? "Examen terminé"}
                </h1>
                <p className="text-muted">Vos réponses sont bien enregistrées.</p>
              </div>
            </div>
            <div className="rounded-xl bg-canvas px-5 py-1">
              <Row label="Examen">{receipt.examTitle}</Row>
              <Row label="Soumis le">{formatDateTime(receipt.submittedAt)}</Row>
              {/* Détail (nombre de questions…) seulement si le formateur le montre. */}
              {counts ? (
                <Row label="Réponses enregistrées">
                  {receipt.answered} sur {receipt.total}
                </Row>
              ) : null}
              <Row label="Référence">
                <span className="font-mono tracking-wider">{receipt.receiptCode ?? "—"}</span>
              </Row>
            </div>
            <div className="flex flex-wrap gap-3">
              <PrintButton />
              <Link
                href={ROUTES.student.home}
                className={buttonVariants({ variant: "mint", className: "print:hidden" })}
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-[1_1_420px]">
          <CardHeader>
            <CardTitle>Votre résultat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {score ? (
              <div className="flex flex-wrap items-center gap-7">
                <div
                  className="flex size-40 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${ring} 0 ${pct}%, var(--color-line-soft) ${pct}% 100%)`,
                  }}
                  role="img"
                  aria-label={`Note ${score.outOf20} sur 20`}
                >
                  <div className="flex size-32 flex-col items-center justify-center rounded-full bg-surface">
                    <span className="font-display text-4xl leading-none font-extrabold">
                      {String(score.outOf20 ?? 0).replace(".", ",")}
                    </span>
                    <span className="mt-1 text-sm text-muted">sur 20</span>
                    <span
                      className={
                        passed
                          ? "mt-1.5 rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-success"
                          : "mt-1.5 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning"
                      }
                    >
                      {passed ? "Réussi" : "Non réussi"}
                    </span>
                  </div>
                </div>
                {counts ? (
                  <p className="flex-[1_1_180px] text-[15px] text-muted">
                    {score.awarded} point{(score.awarded ?? 0) > 1 ? "s" : ""} sur {score.max}.
                    {counts.neutralized > 0
                      ? ` ${counts.neutralized} question(s) neutralisée(s) ne compte(nt) pas.`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : result.awaiting === "correction" ? (
              <div className="flex flex-col gap-3 rounded-xl bg-lilac p-4 text-[15px] text-primary-strong">
                <p className="flex items-center gap-2 font-semibold">
                  <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden /> Correction
                  automatique en cours…
                </p>
                <p className="text-sm">Votre note s&apos;affichera ici dans quelques instants.</p>
                <LiveRefresh intervalSec={5} label="Actualisation" compact />
              </div>
            ) : result.awaiting === "validation" ? (
              <div className="flex items-start gap-3 rounded-xl bg-canvas p-4 text-[15px] text-ink-soft">
                <Hourglass className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <strong className="block text-ink">Résultats disponibles ultérieurement.</strong>
                  Votre copie contient une réponse rédigée ou un algorithme : votre formateur la
                  corrige. Votre note s&apos;affichera ici dès qu&apos;elle sera validée.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl bg-canvas p-4 text-[15px] text-ink-soft">
                <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                Le résultat n&apos;est pas encore publié par votre formateur.
              </div>
            )}

            {counts ? (
              <div className="flex flex-wrap gap-2.5">
                <Stat value={counts.correct} label="Bonnes" tone="bg-success-bg text-success" />
                <Stat value={counts.wrong} label="Mauvaises" tone="bg-danger-bg text-danger" />
                <Stat
                  value={counts.unanswered}
                  label="Sans réponse"
                  tone="bg-neutral-bg text-neutral"
                />
                {counts.invalidated > 0 ? (
                  <Stat
                    value={counts.invalidated}
                    label="Invalidées"
                    tone="bg-warning-bg text-warning"
                  />
                ) : null}
                {counts.neutralized > 0 ? (
                  <Stat
                    value={counts.neutralized}
                    label="Neutralisées"
                    tone="bg-lilac text-primary-strong"
                  />
                ) : null}
              </div>
            ) : null}

            {score && level !== "CORRECTION" ? (
              <p className="text-sm text-muted">
                La correction détaillée n&apos;est pas disponible pour cet examen, ou le sera après
                sa fermeture.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {correction ? (
        <Card>
          <CardHeader>
            <CardTitle>Correction</CardTitle>
            <CardDescription>Dans l&apos;ordre où vous avez vu les questions.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
            {correction.map((q) => (
              <article
                key={q.number}
                className="flex flex-col gap-3 rounded-card border border-line p-4"
              >
                <header className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-lilac text-sm font-extrabold text-primary-strong">
                    {q.number}
                  </span>
                  <span className="ml-auto text-sm font-bold">
                    {q.status === "NEUTRALISEE"
                      ? "Neutralisée"
                      : q.status === "INVALIDEE"
                        ? "Invalidée"
                        : `${q.pointsAwarded ?? 0} / ${q.points} pt`}
                  </span>
                </header>
                <p className="font-display font-semibold whitespace-pre-line">{q.prompt}</p>
                {q.code && (!q.algo || q.algo.kind === "texte") ? (
                  <CodeBlock code={q.code} language={q.codeLanguage} fontSize={13} />
                ) : null}
                {q.algo ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-muted">
                      {q.algo.kind === "texte" ? "Votre réponse" : "Votre algorithme"}
                    </span>
                    <FreeAnswer text={q.algo.code} kind={q.algo.kind} />
                    {q.algo.pending ? (
                      <p className="flex items-center gap-2 rounded-lg bg-lilac px-3 py-2 text-sm text-primary-strong">
                        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Note affichée
                        après validation par votre formateur.
                      </p>
                    ) : q.algo.testsTotal || q.algo.comment ? (
                      <div className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-soft">
                        <strong>Correction automatique.</strong>
                        {q.algo.testsTotal
                          ? ` ${q.algo.testsPassed} / ${q.algo.testsTotal} jeux d'essai réussis.`
                          : null}
                        {q.algo.comment ? (
                          <span className="mt-1 block">{q.algo.comment}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <ul className="flex flex-col gap-1.5">
                  {q.options.map((o, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                        o.isCorrect
                          ? "bg-success-bg font-semibold text-success"
                          : o.selected
                            ? "bg-danger-bg text-danger"
                            : "bg-canvas text-ink-soft",
                      )}
                    >
                      {o.isCorrect ? (
                        <CircleCheck className="size-4 shrink-0" aria-hidden />
                      ) : o.selected ? (
                        <X className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      <span className="flex-1 whitespace-pre-line">{o.label}</span>
                      {o.selected ? <span className="text-xs font-bold">votre réponse</span> : null}
                    </li>
                  ))}
                </ul>
                {q.explanation ? (
                  <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-soft">
                    <strong>Explication.</strong> {q.explanation}
                  </p>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
