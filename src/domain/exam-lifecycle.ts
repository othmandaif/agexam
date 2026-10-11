import { formatTotalDuration } from "./duration";
import type { ExamStatus, TimerMode } from "./enums";

/** État affiché d'un examen, calculé à partir du statut enregistré et de l'heure. */
export type ExamPhase = "BROUILLON" | "PLANIFIE" | "OUVERT" | "FERME" | "ARCHIVE";

export interface ExamTiming {
  status: ExamStatus;
  opensAt: Date | null;
  closesAt: Date | null;
}

export function examPhase(exam: ExamTiming, now: Date): ExamPhase {
  if (exam.status === "BROUILLON" || exam.status === "ARCHIVE" || exam.status === "FERME") {
    return exam.status;
  }
  if (exam.closesAt && now >= exam.closesAt) return "FERME";
  if (exam.opensAt && now >= exam.opensAt) return "OUVERT";
  return "PLANIFIE";
}

export const PHASE_LABELS: Record<ExamPhase, string> = {
  BROUILLON: "Brouillon",
  PLANIFIE: "Planifié",
  OUVERT: "En cours",
  FERME: "Terminé",
  ARCHIVE: "Archivé",
};

export interface PublishCheckInput {
  title: string;
  moduleId: string | null;
  /** Groupes + étudiants ajoutés individuellement. */
  groupCount: number;
  opensAt: Date | null;
  closesAt: Date | null;
  questionCount: number;
  questionErrorCount: number;
  /** Somme des durées des questions (mode PAR_QUESTION). */
  totalDurationSec: number;
  timerMode?: TimerMode;
  /** Mode GLOBAL : durée de tout l'examen. */
  globalDurationSec?: number | null;
}

/** Durée effective d'un examen selon le mode de chrono. */
export function examDurationSec(
  timerMode: TimerMode,
  globalDurationSec: number | null | undefined,
  questionsTotalSec: number,
): number {
  return timerMode === "GLOBAL" ? (globalDurationSec ?? 0) : questionsTotalSec;
}

/**
 * Conditions pour publier. Renvoie la liste des problèmes (vide = publiable).
 * La fenêtre d'ouverture doit laisser le temps de passer tout l'examen.
 */
export function publishProblems(input: PublishCheckInput, now: Date): string[] {
  const problems: string[] = [];
  if (input.title.trim().length < 3) problems.push("Donnez un titre à l'examen.");
  if (!input.moduleId) problems.push("Choisissez un module.");
  if (input.groupCount === 0) problems.push("Choisissez au moins un groupe ou un étudiant.");
  if (input.questionCount === 0) problems.push("Ajoutez au moins une question.");
  if (input.questionErrorCount > 0) {
    problems.push(`Corrigez les ${input.questionErrorCount} erreur(s) dans les questions.`);
  }
  const global = input.timerMode === "GLOBAL";
  if (global && !input.globalDurationSec) problems.push("Indiquez la durée globale de l'examen.");
  const durationSec = examDurationSec(
    input.timerMode ?? "PAR_QUESTION",
    input.globalDurationSec,
    input.totalDurationSec,
  );
  if (!input.opensAt || !input.closesAt) {
    problems.push("Indiquez l'ouverture et la fermeture.");
  } else {
    if (input.closesAt <= input.opensAt) {
      problems.push("La fermeture doit être après l'ouverture.");
    }
    if (input.closesAt <= now) problems.push("La fermeture est déjà passée.");
    const windowSec = (input.closesAt.getTime() - input.opensAt.getTime()) / 1000;
    if (windowSec > 0 && windowSec < durationSec) {
      problems.push(
        `La période d'ouverture (${formatTotalDuration(windowSec)}) est plus courte que la durée de l'examen (${formatTotalDuration(durationSec)}).`,
      );
    }
  }
  return problems;
}

/**
 * Le contenu (questions, durées) n'est modifiable que tant qu'aucun étudiant
 * n'a commencé : sinon les tentatives ne seraient plus comparables.
 */
export function canEditContent(attemptCount: number): boolean {
  return attemptCount === 0;
}
