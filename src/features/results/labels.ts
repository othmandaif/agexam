import type { AttemptQuestionStatus } from "@/domain/enums";
import type { QuestionSignal } from "@/domain/statistics";
import type { ResultStatus } from "./types";

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  ABSENT: "Absent",
  EN_COURS: "En cours",
  SOUMISE: "Rendue",
  SOUMISE_AUTO: "Soumise auto.",
  EXPIREE: "Temps écoulé",
  ANNULEE: "Annulée",
};

export const RESULT_STATUS_TONE: Record<
  ResultStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  ABSENT: "neutral",
  EN_COURS: "info",
  SOUMISE: "success",
  SOUMISE_AUTO: "danger",
  EXPIREE: "warning",
  ANNULEE: "neutral",
};

export const SIGNAL_LABELS: Record<QuestionSignal, string> = {
  SUSPECT_KEY: "Clé à vérifier",
  TOO_HARD: "Très difficile",
  TOO_EASY: "Très facile",
  LOW_DISCRIMINATION: "Peu discriminante",
};

export const SIGNAL_HINTS: Record<QuestionSignal, string> = {
  SUSPECT_KEY:
    "Une mauvaise réponse est plus choisie que la bonne (par les meilleurs, ou par une large majorité) : la bonne réponse est peut-être mal saisie.",
  TOO_HARD: "Moins d'un quart de la classe a trouvé. Énoncé ambigu ou notion pas vue ?",
  TOO_EASY: "Presque tout le monde a trouvé : la question ne départage pas.",
  LOW_DISCRIMINATION: "Les meilleurs ne réussissent pas mieux que les autres.",
};

export const QUESTION_STATUS_LABELS: Record<AttemptQuestionStatus, string> = {
  A_VENIR: "Non vue",
  EN_COURS: "En cours",
  REPONDUE: "Répondue",
  EXPIREE: "Sans réponse",
  INVALIDEE: "Invalidée (sanction)",
  NEUTRALISEE: "Neutralisée (coupure réseau)",
};

/** « 12,5 » */
export const fmtScore = (n: number | null) =>
  n === null ? "—" : String(Math.round(n * 100) / 100).replace(".", ",");

/** « 1 min 05 », « 42 s » */
export function fmtSeconds(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}

export const fmtPercent = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

/** Verdict global de la correction d'un algorithme. */
export const VERDICT_LABEL = {
  correct: "Algorithme entièrement juste",
  presque: "Presque juste (petite erreur)",
  partiel: "Partiellement juste",
  insuffisant: "Insuffisant (démarche à peine amorcée)",
  hors_sujet: "Hors sujet",
  vide: "Copie vide",
} as const;
