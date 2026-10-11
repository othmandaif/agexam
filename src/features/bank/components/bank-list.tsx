"use client";

import { Check, ClipboardCopy, Code2, FilePlus2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QUESTION_TYPE_LABELS } from "@/components/exam/question-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABELS } from "../schemas";
import { bankQuestionsToText } from "../text";
import type { BankQuestion } from "../types";

const MAX_SELECTION = 60;

export function BankList({ items }: { items: BankQuestion[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const chosen = selected
    .map((id) => items.find((q) => q.id === id))
    .filter((q): q is BankQuestion => !!q);

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SELECTION ? s : [...s, id],
    );

  return (
    <div className="flex flex-col gap-3 pb-24">
      <ul className="flex flex-col gap-2.5">
        {items.map((q) => (
          <BankRow
            key={q.id}
            q={q}
            selected={selected.includes(q.id)}
            onToggle={() => toggle(q.id)}
          />
        ))}
      </ul>

      {chosen.length > 0 ? (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-3 rounded-full bg-ink px-5 py-2.5 text-white shadow-pop">
            <span className="text-sm font-bold">
              {chosen.length} question{chosen.length > 1 ? "s" : ""} sélectionnée
              {chosen.length > 1 ? "s" : ""}
            </span>
            <Link
              href={paths.newExamFromBank(chosen.map((q) => q.id))}
              className={buttonVariants({ variant: "mint", size: "sm" })}
            >
              <FilePlus2 aria-hidden /> Créer un examen
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={async () => {
                await navigator.clipboard.writeText(bankQuestionsToText(chosen));
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
              {copied ? "Texte copié" : "Copier le texte"}
            </Button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-full p-1.5 hover:bg-white/10"
              aria-label="Vider la sélection"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BankRow({
  q,
  selected,
  onToggle,
}: {
  q: BankQuestion;
  selected: boolean;
  onToggle: () => void;
}) {
  const s = q.stats;
  const correct = q.options.filter((o) => o.isCorrect).map((o) => o.label);
  return (
    <li
      className={cn(
        "flex items-start gap-4 rounded-card border bg-surface px-4 py-3.5 transition-colors",
        selected ? "border-primary bg-primary-wash" : "border-line hover:border-[#b8c0ff]",
        q.archived && "opacity-70",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 size-[18px] shrink-0 cursor-pointer accent-primary"
        aria-label={`Sélectionner : ${q.prompt.slice(0, 60)}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          href={paths.bankQuestion(q.id)}
          className="line-clamp-2 text-[15px] font-semibold text-ink no-underline hover:text-primary"
        >
          {q.prompt}
        </Link>
        <p className="truncate text-sm text-muted">
          <Check className="mr-1 inline size-3.5 text-success" aria-hidden />
          {correct.join(" · ")}
          <span className="text-line"> · </span>
          {q.options.length} réponses
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{q.moduleCode}</Badge>
          {q.chapterName ? <Badge tone="neutral">{q.chapterName}</Badge> : null}
          <Badge tone="info">{QUESTION_TYPE_LABELS[q.type]}</Badge>
          {q.code ? (
            <Badge tone="info">
              <Code2 className="size-3.5" aria-hidden /> Code
            </Badge>
          ) : null}
          <DifficultyBadge set={q.difficulty} observed={s.observed} />
          {q.version > 1 ? <Badge tone="neutral">v{q.version}</Badge> : null}
          {q.archived ? <Badge tone="warning">Archivée</Badge> : null}
        </div>
      </div>
      <div className="hidden w-48 shrink-0 flex-col items-end gap-1 text-right sm:flex">
        {s.successRate !== null ? (
          <>
            <span className="font-display text-xl font-bold tabular-nums">
              {Math.round(s.successRate * 100)} %
              <span className="ml-1 text-xs font-semibold text-muted">réussite</span>
            </span>
            <span className="h-1.5 w-32 overflow-hidden rounded-full bg-line-soft" aria-hidden>
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${s.successRate * 100}%` }}
              />
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">
            {s.examCount > 0 ? "Aucune réponse comptée" : "Pas encore passée"}
          </span>
        )}
        <span className="text-xs text-muted tabular-nums">
          {s.examCount} examen{s.examCount > 1 ? "s" : ""}
          {s.draftCount ? ` · ${s.draftCount} brouillon${s.draftCount > 1 ? "s" : ""}` : ""}
          {s.responses ? ` · ${s.responses} rép.` : ""}
        </span>
      </div>
    </li>
  );
}

export function DifficultyBadge({
  set,
  observed,
}: {
  set: BankQuestion["difficulty"];
  observed: BankQuestion["stats"]["observed"];
}) {
  const tone = (d: BankQuestion["difficulty"]) =>
    d === "FACILE" ? "success" : d === "DIFFICILE" ? "danger" : "warning";
  if (observed && observed !== set) {
    return (
      <Badge
        tone={tone(observed)}
        title={`Classée « ${DIFFICULTY_LABELS[set]} », observée « ${DIFFICULTY_LABELS[observed]} »`}
      >
        {DIFFICULTY_LABELS[observed]}
        <span className="font-semibold opacity-70">(observée)</span>
      </Badge>
    );
  }
  return <Badge tone={tone(set)}>{DIFFICULTY_LABELS[set]}</Badge>;
}
