"use client";

import { CircleAlert, Clock, ListChecks, Lock, Sparkles, Star, TriangleAlert } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { QuestionCard } from "@/components/exam/question-card";
import { Button } from "@/components/ui/button";
import {
  formatDuration,
  formatTotalDuration,
  isDurationInRange,
  parseDuration,
} from "@/domain/duration";
import {
  EXAMPLE_QUESTION_TEXT,
  parseQuestionText,
  setFieldForAll,
  setQuestionField,
  suggestDuration,
  summarize,
  type ParsedQuestion,
} from "@/domain/question-text";
import { cn } from "@/lib/utils";
import { BankPicker } from "@/features/bank/components/bank-picker";
import { FormatGuide } from "./format-guide";
import { QuestionFileImport } from "./question-file-import";

const LINE_HEIGHT_PX = 22;

interface QuestionWorkspaceProps {
  text: string;
  onTextChange: (text: string) => void;
  locked: boolean;
  /** Module de l'examen : le sélecteur de la banque le propose par défaut. */
  moduleId?: string | null;
  /** Chrono global : les durées par question ne servent pas, on les masque. */
  globalTimer?: boolean;
}

/** Saisie du texte, aperçu en direct et réglage des durées question par question. */
export function QuestionWorkspace({
  text,
  onTextChange,
  locked,
  moduleId = null,
  globalTimer = false,
}: QuestionWorkspaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deferredText = useDeferredValue(text);
  const parsed = useMemo(() => parseQuestionText(deferredText), [deferredText]);
  const summary = useMemo(() => summarize(parsed), [parsed]);
  const [bulkDuration, setBulkDuration] = useState("45s");
  const bulkSec = parseDuration(bulkDuration);

  /** Les modifications ciblées repartent toujours du texte courant (pas de la version différée). */
  const fresh = () => parseQuestionText(text).questions;

  const appendText = (incoming: string) => {
    const clean = incoming.trim();
    if (!clean) return;
    onTextChange(text.trim() ? `${text.trimEnd()}\n\n${clean}\n` : `${clean}\n`);
  };

  const goToLine = (line: number) => {
    const el = textareaRef.current;
    if (!el) return;
    const lines = text.split("\n");
    const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
    const end = start + (lines[line - 1]?.length ?? 0);
    el.focus();
    el.setSelectionRange(start, end);
    el.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT_PX);
  };

  const setDuration = (q: ParsedQuestion, sec: number) => {
    const target = fresh().find((x) => x.number === q.number);
    if (target) onTextChange(setQuestionField(text, target, "DUREE", formatDuration(sec)));
  };

  const setPoints = (q: ParsedQuestion, points: number) => {
    const target = fresh().find((x) => x.number === q.number);
    if (target) onTextChange(setQuestionField(text, target, "POINTS", String(points)));
  };

  const applyToAll = (valueFor: (q: ParsedQuestion) => string) => {
    const qs = fresh();
    onTextChange(setFieldForAll(text, qs, "DUREE", (i) => valueFor(qs[i]!)));
  };

  const errorList = [
    ...parsed.globalErrors.map((e) => ({ line: e.line, label: `Ligne ${e.line} : ${e.message}` })),
    ...parsed.questions.flatMap((q) =>
      q.errors.map((e) => ({ line: q.startLine, label: `Question ${q.number} : ${e}` })),
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Résumé */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-canvas px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-bold">
          <ListChecks className="size-4 text-primary" aria-hidden />
          {summary.questionCount} question{summary.questionCount > 1 ? "s" : ""}
        </span>
        {globalTimer ? (
          <span className="flex items-center gap-2 font-semibold text-muted">
            <Clock className="size-4 text-primary" aria-hidden />
            Durée globale (durées par question ignorées)
          </span>
        ) : (
          <span className="flex items-center gap-2 font-bold">
            <Clock className="size-4 text-primary" aria-hidden />
            {formatTotalDuration(summary.totalDurationSec)}
          </span>
        )}
        <span className="flex items-center gap-2 font-bold">
          <Star className="size-4 text-primary" aria-hidden />
          {summary.totalPoints} point{summary.totalPoints > 1 ? "s" : ""}
        </span>
        {summary.errorCount > 0 ? (
          <span className="flex items-center gap-2 font-bold text-danger">
            <CircleAlert className="size-4" aria-hidden />
            {summary.errorCount} erreur{summary.errorCount > 1 ? "s" : ""}
          </span>
        ) : summary.questionCount > 0 ? (
          <span className="font-bold text-success">Aucune erreur</span>
        ) : null}
        {summary.warningCount > 0 ? (
          <span className="flex items-center gap-2 font-semibold text-warning">
            <TriangleAlert className="size-4" aria-hidden />
            {summary.warningCount} avertissement{summary.warningCount > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {locked ? (
        <p className="flex items-center gap-2 rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          <Lock className="size-4" aria-hidden />
          Des étudiants ont commencé : les questions et les durées ne sont plus modifiables.
        </p>
      ) : (
        <FormatGuide onInsertExample={() => appendText(EXAMPLE_QUESTION_TEXT)} />
      )}

      <div className="flex flex-wrap items-start gap-5">
        {/* Saisie */}
        <section
          className="flex min-w-0 flex-[1_1_440px] flex-col gap-3"
          aria-label="Texte des questions"
        >
          {!locked ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-start gap-2">
                <BankPicker
                  moduleId={moduleId}
                  existingPrompts={parsed.questions.map((q) => q.prompt)}
                  onInsert={appendText}
                />
                <QuestionFileImport onText={appendText} />
              </div>
              {text.trim() ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Effacer tout le texte des questions ?")) onTextChange("");
                  }}
                >
                  Tout effacer
                </Button>
              ) : null}
            </div>
          ) : null}
          <label htmlFor="question-text" className="sr-only">
            Questions au format texte
          </label>
          <textarea
            id="question-text"
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            readOnly={locked}
            spellCheck={false}
            placeholder={
              "Q: Votre première question ?\nA) Réponse fausse\nB) Bonne réponse *\nC) Autre réponse\nDUREE: 45s"
            }
            className={cn(
              "h-[620px] w-full resize-y rounded-xl border border-line bg-surface p-4 font-mono text-sm text-ink",
              "focus:border-primary focus:shadow-[0_0_0_3px_#dfe3ff] focus:outline-none",
              locked && "bg-canvas text-ink-soft",
            )}
            style={{ lineHeight: `${LINE_HEIGHT_PX}px`, tabSize: 4 }}
          />
          {errorList.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-xl bg-danger-bg p-3" role="alert">
              <p className="text-sm font-bold text-danger">À corriger</p>
              <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                {errorList.map((e, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => goToLine(e.line)}
                      className="text-left text-sm text-danger underline-offset-2 hover:underline"
                    >
                      {e.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* Aperçu + durées */}
        <section
          className="flex min-w-0 flex-[1_1_420px] flex-col gap-3"
          aria-label="Aperçu des questions"
        >
          {!locked && !globalTimer && summary.questionCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
              <label htmlFor="bulk-duration" className="text-sm font-bold">
                Durée pour toutes
              </label>
              <input
                id="bulk-duration"
                value={bulkDuration}
                onChange={(e) => setBulkDuration(e.target.value)}
                className={cn(
                  "h-9 w-24 rounded-field border px-2 text-center font-mono text-sm",
                  bulkSec !== null && isDurationInRange(bulkSec)
                    ? "border-line"
                    : "border-danger-fill",
                )}
                aria-invalid={bulkSec === null || !isDurationInRange(bulkSec)}
              />
              <Button
                size="sm"
                variant="soft"
                disabled={bulkSec === null || !isDurationInRange(bulkSec)}
                onClick={() => applyToAll(() => formatDuration(bulkSec!))}
              >
                Appliquer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  applyToAll((q) =>
                    formatDuration(
                      suggestDuration({
                        type: q.type,
                        hasCode: !!q.code,
                        multipleAnswers: q.multipleAnswers,
                        promptLength: q.prompt.length,
                      }),
                    ),
                  )
                }
              >
                <Sparkles aria-hidden /> Durées suggérées
              </Button>
            </div>
          ) : null}

          <div className="relative flex h-[620px] flex-col gap-3 overflow-y-auto rounded-xl bg-canvas p-3">
            {parsed.questions.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
                <ListChecks className="size-8 text-primary" aria-hidden />
                L&apos;aperçu des questions s&apos;affiche ici pendant la saisie.
                {!locked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => appendText(EXAMPLE_QUESTION_TEXT)}
                  >
                    Insérer un exemple
                  </Button>
                ) : null}
              </div>
            ) : (
              parsed.questions.map((q) => (
                <QuestionCard
                  key={`${q.number}-${q.startLine}`}
                  question={{ ...q, options: q.options }}
                  onErrorClick={() => goToLine(q.startLine)}
                  meta={
                    locked ? undefined : (
                      <>
                        {globalTimer ? null : (
                          <DurationField
                            key={`d-${q.number}-${q.durationSec}`}
                            seconds={q.durationSec}
                            suggested={!q.durationFromText}
                            onCommit={(sec) => setDuration(q, sec)}
                          />
                        )}
                        <PointsField
                          key={`p-${q.number}-${q.points}`}
                          points={q.points}
                          onCommit={(p) => setPoints(q, p)}
                        />
                      </>
                    )
                  }
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DurationField({
  seconds,
  suggested,
  onCommit,
}: {
  seconds: number;
  suggested: boolean;
  onCommit: (sec: number) => void;
}) {
  const [value, setValue] = useState(formatDuration(seconds));
  const parsedSec = parseDuration(value);
  const valid = parsedSec !== null && isDurationInRange(parsedSec);

  const commit = () => {
    if (valid && parsedSec !== seconds) onCommit(parsedSec!);
    else if (!valid) setValue(formatDuration(seconds));
  };

  return (
    <label
      className="flex items-center gap-1.5 text-xs font-semibold text-muted"
      title={suggested ? "Durée suggérée automatiquement" : undefined}
    >
      <Clock className="size-3.5" aria-hidden />
      <span className="sr-only">Durée</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        aria-invalid={!valid}
        className={cn(
          "h-8 w-20 rounded-field border px-2 text-center font-mono text-sm text-ink",
          valid ? "border-line" : "border-danger-fill",
          suggested && "border-dashed",
        )}
      />
    </label>
  );
}

function PointsField({ points, onCommit }: { points: number; onCommit: (p: number) => void }) {
  const [value, setValue] = useState(String(points));
  const n = Number(value.replace(",", "."));
  const valid = Number.isFinite(n) && n > 0 && n <= 100;

  const commit = () => {
    if (valid && n !== points) onCommit(Math.round(n * 100) / 100);
    else if (!valid) setValue(String(points));
  };

  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
      <Star className="size-3.5" aria-hidden />
      <span className="sr-only">Points</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        aria-invalid={!valid}
        className={cn(
          "h-8 w-14 rounded-field border px-2 text-center font-mono text-sm text-ink",
          valid ? "border-line" : "border-danger-fill",
        )}
      />
      pt
    </label>
  );
}
