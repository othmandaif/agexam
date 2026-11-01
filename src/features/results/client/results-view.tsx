"use client";

import { AlertTriangle, Code2, ListChecks } from "lucide-react";
import Link from "next/link";
import { paths } from "@/lib/routes";
import { useState } from "react";
import type { ExamResults } from "../types";
import { QuestionAnalysisCard } from "./question-analysis";
import { ResultsSummary } from "./results-summary";
import { ScoreHistogram, SuccessByQuestion } from "./score-charts";

export function ResultsView({
  results,
  studentsTable,
}: {
  results: Omit<ExamResults, "students">;
  /** Tableau paginé côté serveur (seule la page courante est envoyée au navigateur). */
  studentsTable: React.ReactNode;
}) {
  const { summary, exam } = results;
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  const toCheck = results.questions.filter((q) => !q.neutralized && q.analysis.signals.length > 0);
  const neutralized = results.questions.filter((q) => q.neutralized).length;
  const shownQuestions = onlyFlagged ? toCheck : results.questions;

  const openQuestion = (id: string) => {
    setOnlyFlagged(false);
    setHighlight(id);
    requestAnimationFrame(() =>
      document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <ResultsSummary results={results} />

      {exam.phase === "OUVERT" && summary.inProgress > 0 ? (
        <p className="rounded-field bg-lilac px-4 py-2.5 text-sm text-primary-strong">
          L&apos;examen est encore ouvert : {summary.inProgress} copie
          {summary.inProgress > 1 ? "s" : ""} en cours. Les chiffres bougeront à chaque copie
          rendue.
        </p>
      ) : null}

      {summary.algoToReview.length > 0 ? (
        <section className="flex flex-col gap-2.5 rounded-card border border-warning/30 bg-warning-bg px-5 py-4">
          <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <Code2 className="size-5 text-warning" aria-hidden />
            {summary.algoToReview.length} copie{summary.algoToReview.length > 1 ? "s" : ""} avec un
            algorithme à valider
          </p>
          <p className="text-sm text-ink-soft">
            Tant qu&apos;elle n&apos;est pas validée, la note de la réponse compte 0 dans la note
            sur 20. Ouvrez la copie : vous y verrez le code rendu, la note proposée avec
            l&apos;explication de chaque critère, et les boutons « Valider la note proposée » ou «
            Modifier la note ».
          </p>
          <ul className="flex flex-wrap gap-2">
            {summary.algoToReview.map((c) => (
              <li key={c.attemptId}>
                <Link
                  href={`${paths.examCopy(exam.id, c.attemptId)}#algo`}
                  className="inline-flex items-center rounded-full border border-warning/40 bg-surface px-3 py-1 text-sm font-semibold text-ink no-underline hover:border-warning"
                >
                  {c.fullName}
                  {c.count > 1 ? ` (${c.count})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {studentsTable}

      <div className="grid gap-5 lg:grid-cols-2">
        <ScoreHistogram bins={results.histogram} mean={summary.mean} />
        <SuccessByQuestion questions={results.questions} onOpen={openQuestion} />
      </div>

      <section id="questions" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-lilac text-primary">
              <ListChecks className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[18px] font-bold">Détail des questions</h2>
              <p className="text-[13px] text-muted">
                {results.questions.length} questions
                {toCheck.length ? ` · ${toCheck.length} à vérifier` : ""}
                {neutralized ? ` · ${neutralized} neutralisée${neutralized > 1 ? "s" : ""}` : ""}
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
            />
            Seulement les questions à vérifier
          </label>
        </div>

        {toCheck.length === 0 && summary.submitted >= 5 ? (
          <p className="rounded-field bg-success-bg px-4 py-2.5 text-sm font-semibold text-success">
            Aucune question ne semble poser problème.
          </p>
        ) : null}
        {summary.submitted > 0 && summary.submitted < 5 ? (
          <p className="flex items-center gap-2 rounded-field bg-neutral-bg px-4 py-2.5 text-sm text-neutral">
            <AlertTriangle className="size-4" aria-hidden />
            Moins de 5 copies : pas encore assez pour signaler les questions douteuses.
          </p>
        ) : null}
        {shownQuestions.map((q) => (
          <QuestionAnalysisCard
            key={q.examQuestionId}
            examId={exam.id}
            question={q}
            highlighted={highlight === q.examQuestionId}
          />
        ))}
      </section>
    </div>
  );
}
