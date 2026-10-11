"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Library, LoaderCircle, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { QUESTION_TYPE_LABELS } from "@/components/exam/question-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bankQuestionsToText } from "../text";
import type { BankListResult, BankQuestion } from "../types";

async function search(q: string, moduleId: string | null): Promise<BankListResult> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (moduleId) params.set("module", moduleId);
  params.set("tri", "used");
  const res = await fetch(`/api/v1/questions?${params}`, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as {
    data?: BankListResult;
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(json?.error?.message ?? "Erreur du serveur.");
  return json!.data!;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Bouton + fenêtre « Ajouter depuis la banque » : les questions choisies sont ajoutées
 * au texte de l'examen (format AGExam), avec leur durée et leurs points suggérés.
 */
export function BankPicker({
  moduleId,
  existingPrompts,
  onInsert,
}: {
  moduleId: string | null;
  existingPrompts: string[];
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Library aria-hidden /> Ajouter depuis la banque
      </Button>
      {open ? (
        <PickerDialog
          moduleId={moduleId}
          existingPrompts={existingPrompts}
          onClose={() => setOpen(false)}
          onInsert={(text) => {
            onInsert(text);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PickerDialog({
  moduleId,
  existingPrompts,
  onClose,
  onInsert,
}: {
  moduleId: string | null;
  existingPrompts: string[];
  onClose: () => void;
  onInsert: (text: string) => void;
}) {
  const [q, setQ] = useState("");
  const [onlyModule, setOnlyModule] = useState(!!moduleId);
  const [picked, setPicked] = useState<BankQuestion[]>([]);
  const deferred = useDeferredValue(q.trim());
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = new Set(existingPrompts.map(norm));
  const scope = onlyModule ? moduleId : null;

  const query = useQuery({
    queryKey: ["bank-picker", deferred, scope],
    queryFn: () => search(deferred, scope),
    staleTime: 30_000,
  });

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const toggle = (item: BankQuestion) =>
    setPicked((p) =>
      p.some((x) => x.id === item.id) ? p.filter((x) => x.id !== item.id) : [...p, item],
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#141832]/50 p-6 pt-[6vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-picker-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-panel bg-surface shadow-pop"
      >
        <header className="flex flex-col gap-3 border-b border-line-soft px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="bank-picker-title" className="font-display text-xl font-bold">
              Ajouter depuis la banque
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-muted hover:bg-canvas"
              aria-label="Fermer"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-60 flex-1">
              <span className="sr-only">Rechercher</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher dans l'énoncé, le code, les réponses…"
                className="h-11 w-full rounded-field border border-line pr-3 pl-10 text-[15px] outline-none focus:border-primary"
              />
            </label>
            {moduleId ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={onlyModule}
                  onChange={(e) => setOnlyModule(e.target.checked)}
                />
                Module de l&apos;examen seulement
              </label>
            ) : null}
          </div>
        </header>

        <div className="min-h-48 flex-1 overflow-y-auto px-6 py-4">
          {query.isPending ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Recherche…
            </p>
          ) : query.isError ? (
            <p className="py-12 text-center text-sm text-danger">{query.error.message}</p>
          ) : query.data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              {deferred
                ? "Aucune question ne correspond."
                : "Aucune question dans la banque pour ce module."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {query.data.items.map((item) => {
                const isPicked = picked.some((x) => x.id === item.id);
                const already = existing.has(norm(item.prompt));
                return (
                  <li key={item.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-card border px-4 py-3 transition-colors",
                        isPicked
                          ? "border-primary bg-primary-wash"
                          : "border-line hover:border-[#b8c0ff]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => toggle(item)}
                        className="mt-1 size-[18px] shrink-0 accent-primary"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="line-clamp-2 text-[15px] font-semibold">
                          {item.prompt}
                        </span>
                        <span className="truncate text-sm text-muted">
                          <Check className="mr-1 inline size-3.5 text-success" aria-hidden />
                          {item.options
                            .filter((o) => o.isCorrect)
                            .map((o) => o.label)
                            .join(" · ")}
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge tone="neutral">{item.moduleCode}</Badge>
                          <Badge tone="info">{QUESTION_TYPE_LABELS[item.type]}</Badge>
                          {item.stats.successRate !== null ? (
                            <Badge tone="neutral">
                              {Math.round(item.stats.successRate * 100)} % de réussite
                            </Badge>
                          ) : null}
                          {already ? <Badge tone="warning">Déjà dans l&apos;examen</Badge> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {query.data?.truncated ? (
            <p className="pt-3 text-center text-xs text-muted">
              {query.data.items.length} questions affichées sur {query.data.total} : précisez la
              recherche.
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line-soft bg-canvas px-6 py-3.5">
          <span className="text-sm font-semibold text-muted">
            {picked.length
              ? `${picked.length} question${picked.length > 1 ? "s" : ""} choisie${picked.length > 1 ? "s" : ""}`
              : "Cochez les questions à ajouter"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              disabled={picked.length === 0}
              onClick={() => onInsert(bankQuestionsToText(picked))}
            >
              Ajouter à l&apos;examen
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
