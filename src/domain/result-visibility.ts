import type { ExamStatus, ResultReleaseMode, ResultVisibility } from "./enums";

export interface ResultReleaseInput {
  visibility: ResultVisibility;
  releaseMode: ResultReleaseMode;
  examStatus: ExamStatus;
  examClosesAt: Date;
  resultsPublishedAt: Date | null;
  attemptSubmitted: boolean;
  /** Copie rendue individuellement par le formateur (avant la publication générale). */
  attemptReleasedAt?: Date | null;
}

function isExamClosed(input: ResultReleaseInput, now: Date): boolean {
  return (
    input.examStatus === "FERME" ||
    input.examStatus === "ARCHIVE" ||
    now.getTime() >= input.examClosesAt.getTime()
  );
}

export function areResultsReleased(input: ResultReleaseInput, now: Date): boolean {
  if (!input.attemptSubmitted) return false;
  if (input.attemptReleasedAt && input.attemptReleasedAt <= now) return true;
  switch (input.releaseMode) {
    case "IMMEDIAT":
      return true;
    case "APRES_FERMETURE":
      return isExamClosed(input, now);
    case "MANUEL":
      return input.resultsPublishedAt !== null && input.resultsPublishedAt <= now;
  }
}

/**
 * Niveau de détail que le serveur a le droit d'envoyer à l'étudiant.
 * La correction complète n'est jamais envoyée avant la fermeture de l'examen,
 * pour éviter que les premiers à finir transmettent les réponses.
 */
export function revealLevel(input: ResultReleaseInput, now: Date): ResultVisibility {
  if (!areResultsReleased(input, now)) return "AUCUNE";
  if (input.visibility === "CORRECTION" && !isExamClosed(input, now)) return "NOTE_DETAIL";
  return input.visibility;
}
