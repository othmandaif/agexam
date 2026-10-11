import { PASS_MARK } from "@/domain/statistics";
import type { ResultStudent } from "./types";

export const STUDENT_STATUS_FILTERS = {
  passed: "Réussi",
  failed: "Échoué",
  review: "À revoir",
  absent: "Absent",
} as const;
export type StudentStatusFilter = keyof typeof STUDENT_STATUS_FILTERS;

/** Filtre (recherche + statut) et tri par rang, appliqués côté serveur. */
export function filterStudents(
  students: ResultStudent[],
  f: { q?: string; statut?: string },
): ResultStudent[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const test = (s: ResultStudent) => {
    switch (f.statut) {
      case "passed":
        return s.scoreOutOf20 !== null && s.scoreOutOf20 >= PASS_MARK;
      case "failed":
        return s.scoreOutOf20 !== null && s.scoreOutOf20 < PASS_MARK;
      case "review":
        return s.flagged;
      case "absent":
        return s.status === "ABSENT";
      default:
        return true;
    }
  };
  return students
    .filter(
      (s) =>
        test(s) &&
        (!q ||
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.groups.toLowerCase().includes(q)),
    )
    .sort(
      (a, b) =>
        (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        a.fullName.localeCompare(b.fullName, "fr"),
    );
}
