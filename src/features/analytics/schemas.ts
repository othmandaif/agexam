import { z } from "zod";
import type { AnalyticsFilters, AnalyticsPeriod } from "./types";

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  annee: "Toute l'année scolaire",
  "90j": "3 derniers mois",
  "30j": "30 derniers jours",
  tout: "Depuis le début",
};

const uuidOrNull = (v: unknown) =>
  typeof v === "string" && z.uuid().safeParse(v).success ? v : null;

/** Filtres lus dans l'URL ; une valeur invalide est ignorée. */
export function parseAnalyticsFilters(
  params: Record<string, string | string[] | undefined>,
): AnalyticsFilters {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const period = one("periode");
  return {
    moduleId: uuidOrNull(one("module")),
    groupId: uuidOrNull(one("groupe")),
    examId: uuidOrNull(one("examen")),
    period: period && period in PERIOD_LABELS ? (period as AnalyticsPeriod) : "annee",
  };
}
