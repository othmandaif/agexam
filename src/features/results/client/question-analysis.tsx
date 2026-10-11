"use client";

import { AlertTriangle, Ban, Check, KeyRound, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { CodeBlock } from "@/components/exam/code-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { useActionRunner } from "@/lib/use-action-runner";
import { cn } from "@/lib/utils";
import { fmtPercent, fmtSeconds, SIGNAL_HINTS, SIGNAL_LABELS } from "../labels";
import { correctKeyAction, neutralizeQuestionAction } from "../server/actions";
import type { ResultQuestion } from "../types";

const letter = (i: number) => String.fromCharCode(65 + i);

/** Analyse d'une question : réussite, choix, signaux, et corrections possibles. */
export function QuestionAnalysisCard({
  examId,
  question: q,
  highlighted,
}: {
  examId: string;
  question: ResultQuestion;
  highlighted?: boolean;
}) {
  const a = q.analysis;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(
    q.options.filter((o) => o.isCorrect).map((o) => o.id),
  );
  const { state, pending, run } = useActionRunner();
  const maxCount = Math.max(1, ...q.options.map((o) => a.choiceCounts[o.id] ?? 0));

  const toggle = (id: string) =>
    setDraft((d) =>
      q.multiple ? (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]) : [id],
    );

  return (
    <article
      id={`q-${q.examQuestionId}`}
      className={cn(
        "flex scroll-mt-24 flex-col gap-4 rounded-card border bg-surface p-5 transition-shadow",
        highlighted ? "border-primary shadow-[0_0_0_3px_#dfe3ff]" : "border-line",
        q.neutralized && "bg-canvas",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold">Question {q.number}</span>
            <Badge tone="info">{q.multiple ? "Plusieurs réponses" : "Une réponse"}</Badge>
            <Badge tone="neutral">
              {q.points} pt · {fmtSeconds(q.durationSec)}
            </Badge>
            {q.neutralized ? <Badge tone="neutral">Neutralisée</Badge> : null}
            {!q.neutralized
              ? a.signals.map((s) => (
                  <Badge
                    key={s}
                    tone={s === "SUSPECT_KEY" ? "danger" : "warning"}
                    title={SIGNAL_HINTS[s]}
                  >
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {SIGNAL_LABELS[s]}
                  </Badge>
                ))
              : null}
          </div>
          <p
            className={cn(
              "text-[15px] font-semibold whitespace-pre-line",
              q.neutralized && "text-muted line-through",
            )}
          >
            {q.prompt}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 text-center">
          <Stat label="Réussite" value={fmtPercent(a.successRate)} />
          <Stat label="Temps moyen" value={fmtSeconds(a.avgTimeSec)} />
          <Stat
            label="Discrim."
            value={a.discrimination === null ? "—" : a.discrimination.toFixed(2).replace(".", ",")}
            title="Réussite du tiers supérieur − réussite du tiers inférieur (de −1 à 1). Au-dessus de 0,3 : la question départage bien."
          />
        </dl>
      </header>

      {q.code ? (
        <CodeBlock code={q.code} language={q.codeLanguage ?? "PSEUDO_CODE"} fontSize={13} />
      ) : null}

      {!q.neutralized && a.signals.includes("SUSPECT_KEY") ? (
        <p className="flex items-start gap-2 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {SIGNAL_HINTS.SUSPECT_KEY} Vérifiez-la ou neutralisez la question.
        </p>
      ) : null}

      {/* Choix des étudiants */}
      <ul className="flex flex-col gap-2" aria-label="Réponses choisies">
        {q.options.map((o, i) => {
          const count = a.choiceCounts[o.id] ?? 0;
          const share = a.responses ? count / a.responses : 0;
          const selected = draft.includes(o.id);
          return (
            <li key={o.id}>
              <div
                className={cn(
                  "grid grid-cols-[28px_minmax(0,1fr)_minmax(120px,38%)_64px] items-center gap-3 rounded-field px-2 py-1.5",
                  editing && "cursor-pointer hover:bg-primary-wash",
                  editing && selected && "bg-success-bg/60",
                )}
                onClick={editing ? () => toggle(o.id) : undefined}
                role={editing ? (q.multiple ? "checkbox" : "radio") : undefined}
                aria-checked={editing ? selected : undefined}
                tabIndex={editing ? 0 : undefined}
                onKeyDown={
                  editing
                    ? (e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggle(o.id);
                        }
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-[13px] font-bold",
                    (editing ? selected : o.isCorrect)
                      ? "bg-success text-white"
                      : "bg-neutral-bg text-neutral",
                  )}
                >
                  {(editing ? selected : o.isCorrect) ? (
                    <Check className="size-4" aria-label="Bonne réponse" />
                  ) : (
                    letter(i)
                  )}
                </span>
                <span className="min-w-0 text-[15px]">
                  {o.label}
                  {o.isCorrect && !editing ? (
                    <span className="ml-2 text-xs font-bold text-success">bonne réponse</span>
                  ) : null}
                </span>
                <span className="relative h-2.5 rounded-full bg-line-soft">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      o.isCorrect ? "bg-success" : "bg-[#9aa3bd]",
                    )}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="text-right text-sm font-bold tabular-nums">
                  {count}
                  <span className="ml-1 text-xs font-semibold text-muted">
                    {Math.round(share * 100)}%
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        {a.responses} copie{a.responses > 1 ? "s" : ""} analysée{a.responses > 1 ? "s" : ""} ·{" "}
        {a.answered} réponse
        {a.answered > 1 ? "s" : ""} · {a.correct} juste{a.correct > 1 ? "s" : ""}
        {q.multiple ? " (une copie peut cocher plusieurs cases)" : ""}
      </p>

      {/* Actions */}
      {editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-field bg-canvas p-3">
          <p className="text-sm">
            {q.multiple
              ? "Cochez les bonnes réponses (au moins deux)."
              : "Cliquez la bonne réponse."}{" "}
            Toutes les copies seront recalculées.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(q.options.filter((o) => o.isCorrect).map((o) => o.id));
              }}
            >
              <X aria-hidden /> Annuler
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Corriger la bonne réponse et recalculer toutes les notes ?")) {
                  run(
                    () => correctKeyAction(examId, q.examQuestionId, draft),
                    () => setEditing(false),
                  );
                }
              }}
            >
              <Check aria-hidden /> Enregistrer et recalculer
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
          {q.neutralized ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => neutralizeQuestionAction(examId, q.examQuestionId, false))}
            >
              <RotateCcw aria-hidden /> Compter de nouveau
            </Button>
          ) : (
            <>
              <Button variant="soft" size="sm" disabled={pending} onClick={() => setEditing(true)}>
                <KeyRound aria-hidden /> Corriger la bonne réponse
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Neutraliser la question ${q.number} ? Elle ne comptera pour personne et toutes les notes seront recalculées.`,
                    )
                  ) {
                    run(() => neutralizeQuestionAction(examId, q.examQuestionId, true));
                  }
                }}
              >
                <Ban aria-hidden /> Neutraliser
              </Button>
            </>
          )}
        </div>
      )}
      <FormMessage state={state} />
    </article>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex min-w-20 flex-col rounded-field bg-canvas px-2.5 py-2" title={title}>
      <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
