import type { AttemptQuestionStatus } from "./enums";

export interface QuestionScoreInput {
  status: AttemptQuestionStatus;
  selectedOptionIds: readonly string[];
  correctOptionIds: readonly string[];
  points: number;
  /** Nombre total de choix de la question (pour la note partielle). */
  optionCount?: number;
  /**
   * Question notée hors QCM (algorithme) : part des points obtenue (0 à 1),
   * null tant que la correction est en attente (0 point provisoire).
   */
  ratio?: number | null;
}

export interface QuestionScore {
  /** false si la question est neutralisée : retirée du barème. */
  counted: boolean;
  awarded: number;
  max: number;
  isCorrect: boolean | null;
}

/** Égalité d'ensembles : toutes les bonnes cases, et seulement elles (tout ou rien). */
export function isExactMatch(selected: readonly string[], correct: readonly string[]): boolean {
  const a = new Set(selected);
  const b = new Set(correct);
  if (a.size !== b.size || a.size === 0) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Part des points d'une question à plusieurs bonnes réponses :
 * bonnes cochées / total des bonnes − fausses cochées / total des fausses,
 * jamais négative. Tout cocher donne donc 0, et chaque erreur se paie.
 * Exemple (2 bonnes sur 3 choix) : 1 bonne → 50 %, 1 bonne + 1 fausse → 0 %.
 */
export function partialCredit(
  selected: readonly string[],
  correct: readonly string[],
  optionCount: number,
): number {
  const good = new Set(correct);
  const chosen = new Set(selected);
  if (good.size === 0 || chosen.size === 0) return 0;
  let goodHits = 0;
  let badHits = 0;
  for (const id of chosen) {
    if (good.has(id)) goodHits++;
    else badHits++;
  }
  const badTotal = Math.max(0, optionCount - good.size);
  const fraction = goodHits / good.size - (badTotal > 0 ? badHits / badTotal : badHits > 0 ? 1 : 0);
  return Math.max(0, Math.min(1, fraction));
}

export function scoreQuestion(input: QuestionScoreInput): QuestionScore {
  if (input.status === "NEUTRALISEE") {
    return { counted: false, awarded: 0, max: 0, isCorrect: null };
  }
  if (input.status === "INVALIDEE") {
    return { counted: true, awarded: 0, max: input.points, isCorrect: false };
  }
  if (input.ratio !== undefined) {
    const r = Math.max(0, Math.min(1, input.ratio ?? 0));
    const awarded = Math.round(input.points * r * 100) / 100;
    return { counted: true, awarded, max: input.points, isCorrect: r >= 1 };
  }
  const isCorrect = isExactMatch(input.selectedOptionIds, input.correctOptionIds);
  // Une seule bonne réponse : tout ou rien. Plusieurs : note partielle.
  if (input.correctOptionIds.length > 1 && !isCorrect) {
    const fraction = partialCredit(
      input.selectedOptionIds,
      input.correctOptionIds,
      input.optionCount ?? input.correctOptionIds.length,
    );
    const awarded = Math.round(input.points * fraction * 100) / 100;
    return { counted: true, awarded, max: input.points, isCorrect: false };
  }
  return { counted: true, awarded: isCorrect ? input.points : 0, max: input.points, isCorrect };
}

export interface AttemptScore {
  awarded: number;
  max: number;
  /** Note ramenée sur 20, arrondie au centième. */
  outOf20: number;
}

export function scoreAttempt(questions: readonly QuestionScoreInput[]): AttemptScore {
  let awarded = 0;
  let max = 0;
  for (const q of questions) {
    const s = scoreQuestion(q);
    awarded += s.awarded;
    max += s.max;
  }
  const outOf20 = max === 0 ? 0 : Math.round((awarded / max) * 20 * 100) / 100;
  return { awarded, max, outOf20 };
}
