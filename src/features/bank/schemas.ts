import { z } from "zod";
import { DIFFICULTIES, QUESTION_TYPES } from "@/domain/enums";
import type { BankFilters } from "./types";

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && z.uuid().safeParse(v).success ? v : null));

/** Filtres de la banque lus dans l'URL (valeurs invalides ignorées, jamais d'erreur). */
export const bankFiltersSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((v) => (v ?? "").slice(0, 120)),
  module: optionalUuid,
  chapitre: optionalUuid,
  type: z
    .string()
    .optional()
    .transform((v) =>
      (QUESTION_TYPES as readonly string[]).includes(v ?? "") ? (v as BankFilters["type"]) : null,
    ),
  difficulte: z
    .string()
    .optional()
    .transform((v) =>
      (DIFFICULTIES as readonly string[]).includes(v ?? "")
        ? (v as BankFilters["difficulty"])
        : null,
    ),
  archives: z
    .string()
    .optional()
    .transform((v) => v === "1"),
  tri: z
    .string()
    .optional()
    .transform((v): BankFilters["sort"] =>
      v === "used" || v === "hardest" || v === "easiest" ? v : "recent",
    ),
});

export function parseBankFilters(
  params: Record<string, string | string[] | undefined>,
): BankFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const r = bankFiltersSchema.parse(flat);
  return {
    q: r.q,
    moduleId: r.module,
    chapterId: r.chapitre,
    type: r.type,
    difficulty: r.difficulte,
    archived: r.archives,
    sort: r.tri,
  };
}

export const DIFFICULTY_LABELS = {
  FACILE: "Facile",
  MOYENNE: "Moyenne",
  DIFFICILE: "Difficile",
} as const;

export const SORT_LABELS: Record<BankFilters["sort"], string> = {
  recent: "Plus récentes",
  used: "Plus utilisées",
  hardest: "Moins réussies",
  easiest: "Mieux réussies",
};
