"use client";

import { Archive, Search, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { QUESTION_TYPE_LABELS } from "@/components/exam/question-card";
import { Select } from "@/components/ui/select";
import { DIFFICULTIES, QUESTION_TYPES } from "@/domain/enums";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABELS, SORT_LABELS } from "../schemas";
import type { BankFilters } from "../types";

interface Props {
  filters: BankFilters;
  modules: { id: string; code: string; name: string }[];
  chapters: { id: string; name: string }[];
}

/** Filtres de la banque, gardés dans l'URL (partageables, bouton retour du navigateur). */
export function BankFilterBar({ filters, modules, chapters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(filters.q);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Changer de module invalide le chapitre.
    if ("module" in changes) next.delete("chapitre");
    const qs = next.toString();
    start(() => router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false }));
  };

  // Recherche : mise à jour de l'URL 300 ms après la dernière frappe.
  useEffect(() => {
    if (search === filters.q) return;
    const t = window.setTimeout(() => update({ q: search.trim() || null }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const active =
    !!filters.q || !!filters.moduleId || !!filters.type || !!filters.difficulty || filters.archived;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-opacity",
        pending && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Rechercher dans l&apos;énoncé, le code et les réponses</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans l'énoncé, le code, les réponses…"
            className="h-11 w-full rounded-field border border-line bg-surface pr-3 pl-10 text-[15px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_#dfe3ff]"
          />
        </label>
        <div className="w-44">
          <Select
            aria-label="Trier"
            value={filters.sort}
            onChange={(e) => update({ tri: e.target.value === "recent" ? null : e.target.value })}
          >
            {Object.entries(SORT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Module"
          value={filters.moduleId ?? ""}
          onChange={(e) => update({ module: e.target.value || null })}
        >
          <option value="">Tous les modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} · {m.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Chapitre"
          value={filters.chapterId ?? ""}
          disabled={!filters.moduleId || chapters.length === 0}
          onChange={(e) => update({ chapitre: e.target.value || null })}
        >
          <option value="">
            {!filters.moduleId
              ? "Chapitre (choisir un module)"
              : chapters.length
                ? "Tous les chapitres"
                : "Aucun chapitre"}
          </option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Type"
          value={filters.type ?? ""}
          onChange={(e) => update({ type: e.target.value || null })}
        >
          <option value="">Tous les types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Difficulté"
          value={filters.difficulty ?? ""}
          onChange={(e) => update({ difficulte: e.target.value || null })}
        >
          <option value="">Toutes difficultés</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-muted">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={filters.archived}
            onChange={(e) => update({ archives: e.target.checked ? "1" : null })}
          />
          <Archive className="size-4" aria-hidden />
          Voir les questions archivées
        </label>
        {active ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
            onClick={() => {
              setSearch("");
              start(() => router.replace(pathname as Route, { scroll: false }));
            }}
          >
            <X className="size-4" aria-hidden /> Effacer les filtres
          </button>
        ) : null}
      </div>
    </div>
  );
}
