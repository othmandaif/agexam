"use client";

import { ArrowRight, Check, CircleSlash, Lightbulb, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PracticeFeedback } from "../types";

const letter = (i: number) => String.fromCharCode(65 + i);

/** Entraînement : correction de la question qui vient de se terminer. */
export function PracticeFeedbackCard({
  feedback: f,
  total,
  finished,
  busy,
  onContinue,
}: {
  feedback: PracticeFeedback;
  total: number;
  finished: boolean;
  busy: boolean;
  onContinue: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Entrée = continuer (le bouton a le focus).
  useEffect(() => buttonRef.current?.focus(), [f.number]);

  const unanswered = f.selectedOptionIds.length === 0;
  const verdict =
    f.correct === null
      ? { label: "Question neutralisée", tone: "neutral" as const, icon: CircleSlash }
      : f.correct
        ? { label: "Bonne réponse", tone: "success" as const, icon: Check }
        : unanswered
          ? { label: "Temps écoulé, sans réponse", tone: "warning" as const, icon: X }
          : { label: "Mauvaise réponse", tone: "danger" as const, icon: X };
  const Icon = verdict.icon;

  return (
    <section
      className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-7"
      aria-live="polite"
    >
      <header className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            verdict.tone === "success" && "bg-success-bg text-success",
            verdict.tone === "danger" && "bg-danger-bg text-danger",
            verdict.tone === "warning" && "bg-warning-bg text-warning",
            verdict.tone === "neutral" && "bg-neutral-bg text-neutral",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">
            Question {f.number} / {total}
          </span>
          <h2 className="font-display text-2xl font-bold">{verdict.label}</h2>
        </div>
      </header>

      <p className="text-[17px] font-semibold whitespace-pre-line">{f.prompt}</p>

      <ul className="flex flex-col gap-2">
        {f.options.map((o, i) => {
          const chosen = f.selectedOptionIds.includes(o.id);
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-[16px]",
                o.isCorrect && "border-success bg-success-bg",
                chosen && !o.isCorrect && "border-danger-fill bg-danger-bg",
                !chosen && !o.isCorrect && "border-line-soft",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                  o.isCorrect
                    ? "bg-success text-white"
                    : chosen
                      ? "bg-danger-fill text-white"
                      : "bg-neutral-bg text-neutral",
                )}
              >
                {o.isCorrect ? (
                  <Check className="size-4" aria-hidden />
                ) : chosen ? (
                  <X className="size-4" aria-hidden />
                ) : (
                  letter(i)
                )}
              </span>
              <span className="flex-1">{o.label}</span>
              {chosen ? <span className="text-xs font-bold text-ink-soft">votre choix</span> : null}
              {!chosen && o.isCorrect ? (
                <span className="text-xs font-bold text-success">bonne réponse</span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {f.explanation ? (
        <p className="flex items-start gap-3 rounded-[14px] bg-lilac px-4 py-3 text-[15px] text-ink-soft">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>{f.explanation}</span>
        </p>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
        <span className="text-sm text-muted">
          {finished
            ? "C'était la dernière question."
            : "Le chrono de la question suivante démarre quand vous continuez."}
        </span>
        <Button ref={buttonRef} size="lg" variant="mint" disabled={busy} onClick={onContinue}>
          {finished ? "Voir mon bilan" : "Question suivante"} <ArrowRight aria-hidden />
        </Button>
      </footer>
    </section>
  );
}
