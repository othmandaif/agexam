import { CheckCheck, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FreeAnswer } from "@/components/exam/free-answer";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { resumeExamGrading } from "@/features/attempts/server/algo-grader";
import { getManageableExam } from "@/features/exams/server/service";
import { AcceptAllButton } from "@/features/results/client/accept-all-button";
import { AlgoGradePanel } from "@/features/results/client/algo-grade-panel";
import { GradingDetails } from "@/features/results/components/grading-details";
import { fmtScore } from "@/features/results/labels";
import { getGradingQueue } from "@/features/results/server/queries";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Corriger les réponses" };

export default async function GradingQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ vue?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { examId } = await params;
  if (!z.uuid().safeParse(examId).success) notFound();
  let exam;
  try {
    exam = await getManageableExam(user, examId);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  await resumeExamGrading(examId);
  const all = (await searchParams).vue === "toutes";
  const items = await getGradingQueue(examId, !all);
  const proposed = items.filter((i) => i.grading?.status === "proposed").length;
  const running = items.some(
    (i) => !i.grading || ["pending", "running"].includes(i.grading.status),
  );

  return (
    <>
      <PageHeader
        icon={<ClipboardCheck aria-hidden />}
        back={{ href: paths.examResults(examId), label: "Résultats" }}
        title="Corriger les réponses libres"
        description={`${exam.title} · algorithmes et réponses rédigées, copie par copie`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {running ? <LiveRefresh intervalSec={6} label="Correction en cours" compact /> : null}
            {proposed > 0 ? <AcceptAllButton examId={examId} count={proposed} /> : null}
          </div>
        }
      />

      <nav className="flex gap-2" aria-label="Filtre">
        {[
          { href: paths.examGrading(examId), label: "À valider", on: !all },
          { href: paths.examGrading(examId, true), label: "Toutes les réponses", on: all },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold no-underline",
              t.on
                ? "bg-primary text-white"
                : "bg-surface text-ink ring-1 ring-line hover:ring-primary/40",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={all ? "Aucune réponse libre rendue" : "Tout est corrigé"}
          description={
            all
              ? "Aucune copie terminée ne contient d'algorithme ou de réponse rédigée."
              : "Toutes les notes des réponses libres sont validées."
          }
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((it) => {
            const g = it.grading;
            const proposedPts =
              g?.status === "proposed" ? Math.round((g.ratio ?? 0) * it.points * 100) / 100 : null;
            return (
              <li
                key={it.attemptQuestionId}
                className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-soft lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={paths.examCopy(examId, it.attemptId)}
                      className="font-bold text-ink no-underline hover:underline"
                    >
                      {it.fullName}
                    </Link>
                    <Badge tone="neutral">
                      Q{it.questionNumber} · {it.kind === "texte" ? "Rédaction" : "Algorithme"}
                    </Badge>
                    {!g || g.status === "pending" || g.status === "running" ? (
                      <Badge tone="neutral">Correction en cours…</Badge>
                    ) : g.status === "failed" ? (
                      <Badge tone="warning">À corriger</Badge>
                    ) : g.status === "proposed" ? (
                      <Badge tone="warning">
                        Proposée : {fmtScore(proposedPts)} / {fmtScore(it.points)}
                      </Badge>
                    ) : (
                      <Badge tone="success">
                        Validée : {fmtScore(it.pointsAwarded)} / {fmtScore(it.points)}
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-3 text-sm whitespace-pre-line text-muted">{it.prompt}</p>
                  <FreeAnswer text={it.answer} kind={it.kind} />
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-muted">
                      {it.kind === "texte" ? "Réponse attendue" : "Corrigé"}
                    </summary>
                    <div className="mt-2">
                      <FreeAnswer text={it.solution} kind={it.kind} />
                    </div>
                  </details>
                </div>
                <div className="flex min-w-0 flex-col gap-3 rounded-field bg-canvas p-4">
                  {g && (g.status === "proposed" || g.status === "done") ? (
                    <GradingDetails grading={g} points={it.points} />
                  ) : !g || g.status === "pending" || g.status === "running" ? (
                    <div className="flex flex-col gap-2" aria-label="Correction en cours">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-line-soft" />
                      <div className="h-4 w-full animate-pulse rounded bg-line-soft" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-line-soft" />
                    </div>
                  ) : (
                    <p className="text-sm text-warning">
                      La correction automatique n&apos;a pas abouti. Notez manuellement ou relancez.
                    </p>
                  )}
                  <AlgoGradePanel
                    attemptQuestionId={it.attemptQuestionId}
                    points={it.points}
                    current={it.pointsAwarded}
                    proposed={proposedPts}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
