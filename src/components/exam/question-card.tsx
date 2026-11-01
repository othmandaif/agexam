import { Check, CircleAlert, Lock, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/domain/duration";
import type { CodeLanguage, QuestionType } from "@/domain/enums";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  QCM_SIMPLE: "QCM",
  QCM_MULTIPLE: "Plusieurs réponses",
  VRAI_FAUX: "Vrai / Faux",
  TRACE_ALGORITHME: "Trace d'algorithme",
  RECHERCHE_ERREUR: "Recherche d'erreur",
  COMPLEXITE: "Complexité",
  ALGORITHME: "Algorithme à écrire",
  REDACTION: "Réponse rédigée",
};

export interface QuestionCardData {
  /** null : pas de numéro (question seule, ex. banque). */
  number: number | null;
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  options: { label: string; isCorrect: boolean; fixedPosition?: boolean }[];
  type?: QuestionType;
  durationSec: number;
  points: number;
  explanation?: string | null;
  /** Question d'algorithme : corrigé et jeux d'essai (sortie figée si connue). */
  algo?: {
    kind?: "algo" | "texte";
    solution: string;
    tests: { inputs: string[]; expected?: string }[];
  } | null;
  errors?: string[];
  warnings?: string[];
}

interface QuestionCardProps {
  question: QuestionCardData;
  /** Zone d'édition de la durée / des points (aperçu de l'éditeur). */
  meta?: React.ReactNode;
  onErrorClick?: () => void;
  className?: string;
}

/** Aperçu d'une question pour le formateur (bonnes réponses visibles). */
export function QuestionCard({ question: q, meta, onErrorClick, className }: QuestionCardProps) {
  const hasErrors = (q.errors?.length ?? 0) > 0;
  const multiple = q.options.filter((o) => o.isCorrect).length > 1;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-card border bg-surface p-4",
        hasErrors ? "border-danger-fill/60" : "border-line",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        {q.number !== null ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-lilac text-sm font-extrabold text-primary-strong">
            {q.number}
          </span>
        ) : null}
        {q.type ? <Badge tone="info">{QUESTION_TYPE_LABELS[q.type]}</Badge> : null}
        {multiple && q.type !== "QCM_MULTIPLE" ? (
          <Badge tone="info">Plusieurs réponses</Badge>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {meta ?? (
            <>
              <Badge tone="neutral">{formatDuration(q.durationSec)}</Badge>
              <Badge tone="neutral">
                {q.points} pt{q.points > 1 ? "s" : ""}
              </Badge>
            </>
          )}
        </div>
      </header>

      {hasErrors ? (
        <button
          type="button"
          onClick={onErrorClick}
          className="flex flex-col gap-1 rounded-lg bg-danger-bg px-3 py-2 text-left text-sm font-semibold text-danger"
        >
          {q.errors!.map((e) => (
            <span key={e} className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {e}
            </span>
          ))}
        </button>
      ) : null}
      {q.warnings && q.warnings.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
          {q.warnings.map((w) => (
            <span key={w} className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {w}
            </span>
          ))}
        </div>
      ) : null}

      {q.prompt ? (
        <p className="font-display text-base leading-snug font-semibold whitespace-pre-line">
          {q.prompt}
        </p>
      ) : null}
      {q.code ? (
        <div className="flex flex-col gap-1">
          {q.algo && q.algo.kind !== "texte" ? (
            <span className="text-xs font-bold text-muted">Code de départ</span>
          ) : null}
          <CodeBlock code={q.code} language={q.codeLanguage} fontSize={13} />
        </div>
      ) : null}
      {q.algo?.kind === "texte" ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-success">
            Réponse attendue (jamais montrée, sert à la correction)
          </span>
          <p className="rounded-lg bg-success-bg/50 px-3 py-2 text-sm whitespace-pre-line">
            {q.algo.solution}
          </p>
        </div>
      ) : q.algo ? (
        <div className="flex flex-col gap-2">
          {q.algo.solution ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-success">Corrigé (jamais montré)</span>
              <CodeBlock code={q.algo.solution} language="PSEUDO_CODE" fontSize={13} />
            </div>
          ) : null}
          <span className="text-xs font-bold text-muted">
            {q.algo.tests.length} jeu{q.algo.tests.length > 1 ? "x" : ""} d&apos;essai
          </span>
          <ul className="flex flex-col gap-1">
            {q.algo.tests.map((t, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-canvas px-3 py-1.5 font-mono text-[12.5px]"
              >
                <span className="text-muted">
                  {i + 1}. {t.inputs.length ? t.inputs.join(" ; ") : "sans saisie"}
                </span>
                {t.expected !== undefined ? (
                  <span className="whitespace-pre-wrap text-ink">→ {t.expected || "(rien)"}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {q.options.map((o, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2 text-sm",
              o.isCorrect ? "bg-success-bg font-semibold text-success" : "bg-canvas text-ink-soft",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                o.isCorrect ? "bg-success text-white" : "bg-neutral-bg text-neutral",
              )}
            >
              {o.isCorrect ? (
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              ) : (
                String.fromCharCode(65 + i)
              )}
            </span>
            <span className="flex-1 whitespace-pre-line">{o.label}</span>
            {o.fixedPosition ? (
              <span
                className="flex items-center gap-1 text-xs text-muted"
                title="Position fixe : non mélangée"
              >
                <Lock className="size-3" aria-hidden /> fixe
              </span>
            ) : null}
            {o.isCorrect ? <span className="sr-only">(bonne réponse)</span> : null}
          </li>
        ))}
      </ul>

      {q.explanation ? (
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-soft">
          <strong>Explication.</strong> {q.explanation}
        </p>
      ) : null}
    </article>
  );
}
