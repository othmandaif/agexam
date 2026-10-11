import type { AttemptQuestionStatus } from "./enums";

export interface QuestionScoreInput {
  status: AttemptQuestionStatus;
  selectedOptionIds: readonly string[];
  correctOptionIds: readonly string[];
  points: number;
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

export function scoreQuestion(input: QuestionScoreInput): QuestionScore {
  if (input.status === "NEUTRALISEE") {
    return { counted: false, awarded: 0, max: 0, isCorrect: null };
  }
  if (input.status === "INVALIDEE") {
    return { counted: true, awarded: 0, max: input.points, isCorrect: false };
  }
  const isCorrect = isExactMatch(input.selectedOptionIds, input.correctOptionIds);
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
