"use client";

import { Select } from "@/components/ui/select";
import { useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";
import { PERIOD_LABELS } from "../schemas";
import type { AnalyticsData } from "../types";

/** Filtres des statistiques (dans l'URL : partageables, bouton retour du navigateur). */
export function AnalyticsFilterBar({
  filters,
  options,
}: Pick<AnalyticsData, "filters" | "options">) {
  const { set, pending } = useUrlParams();

  return (
    <div
      aria-busy={pending}
      className={cn(
        "grid gap-3 rounded-card border border-line bg-surface p-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-4",
        pending && "opacity-60",
      )}
    >
      <Select
        aria-label="Période"
        value={filters.period}
        onChange={(e) => set({ periode: e.target.value === "annee" ? null : e.target.value })}
      >
        {Object.entries(PERIOD_LABELS)
          .filter(([v]) => v !== "tout")
          .map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
      </Select>
      <Select
        aria-label="Module"
        value={filters.moduleId ?? ""}
        // Changer de module invalide le choix d'examen.
        onChange={(e) => set({ module: e.target.value || null, examen: null })}
      >
        <option value="">Tous les modules</option>
        {options.modules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.code} · {m.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Groupe"
        value={filters.groupId ?? ""}
        onChange={(e) => set({ groupe: e.target.value || null, examen: null })}
      >
        <option value="">Tous les groupes</option>
        {options.groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Examen"
        value={filters.examId ?? ""}
        onChange={(e) => set({ examen: e.target.value || null })}
      >
        <option value="">Tous les examens</option>
        {options.exams.map((x) => (
          <option key={x.id} value={x.id}>
            {x.moduleCode ? `${x.moduleCode} · ` : ""}
            {x.title}
          </option>
        ))}
      </Select>
    </div>
  );
}
