/**
 * Statistiques d'un examen : notes et analyse par question.
 * Fonctions pures, sans dépendance : testées dans statistics.test.ts.
 */

export const PASS_MARK = 10;

export interface ScoreSummary {
  count: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  /** Part des notes ≥ 10/20 (0…1). */
  passRate: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeScores(scores: readonly number[]): ScoreSummary {
  const n = scores.length;
  if (n === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      stdDev: null,
      min: null,
      max: null,
      passRate: null,
    };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  // Écart-type de population : on décrit la classe, on n'estime pas une population plus large.
  const variance = sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return {
    count: n,
    mean: round2(mean),
    median: round2(median),
    stdDev: round2(Math.sqrt(variance)),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    passRate: sorted.filter((x) => x >= PASS_MARK).length / n,
  };
}

export interface HistogramBin {
  /** Borne basse incluse. */
  from: number;
  /** Borne haute exclue (incluse pour la dernière tranche : 20). */
  to: number;
  count: number;
}

/** Répartition des notes sur 20 en tranches de `width` points (2 par défaut → 10 tranches). */
export function histogram(scores: readonly number[], width = 2): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let from = 0; from < 20; from += width) {
    bins.push({ from, to: Math.min(20, from + width), count: 0 });
  }
  for (const s of scores) {
    const clamped = Math.min(20, Math.max(0, s));
    const index = Math.min(bins.length - 1, Math.floor(clamped / width));
    bins[index]!.count++;
  }
  return bins;
}

// ─── Analyse par question ───────────────────────────────────────────────────

/** Réponse d'un étudiant à une question (copie terminée). */
export interface QuestionResponse {
  /** Note de l'étudiant à l'examen, pour l'indice de discrimination. */
  studentScore: number;
  selectedOptionIds: readonly string[];
  /** null : question non comptée pour cet étudiant (neutralisée pour coupure réseau). */
  isCorrect: boolean | null;
  /** Question invalidée par sanction : exclue de l'analyse (elle ne dit rien de la question). */
  invalidated: boolean;
  /** Temps passé, en secondes (null si inconnu). */
  timeSpentSec: number | null;
}

export type QuestionSignal = "SUSPECT_KEY" | "TOO_HARD" | "TOO_EASY" | "LOW_DISCRIMINATION";

export interface QuestionAnalysis {
  /** Copies où la question a été vue et comptée. */
  responses: number;
  answered: number;
  correct: number;
  /** Taux de réussite parmi les copies comptées (0…1). */
  successRate: number | null;
  /** Nombre de copies ayant coché chaque option. */
  choiceCounts: Record<string, number>;
  avgTimeSec: number | null;
  /**
   * Indice de discrimination (−1…1) : réussite du tiers supérieur − réussite du tiers inférieur.
   * Négatif : les meilleurs se trompent plus que les plus faibles → clé probablement fausse.
   */
  discrimination: number | null;
  signals: QuestionSignal[];
}

/** En dessous de ce nombre de copies, on ne tire aucune conclusion. */
export const MIN_RESPONSES_FOR_SIGNALS = 5;

export function analyzeQuestion(
  responses: readonly QuestionResponse[],
  correctOptionIds: readonly string[],
  optionIds: readonly string[],
): QuestionAnalysis {
  const counted = responses.filter((r) => !r.invalidated && r.isCorrect !== null);
  const choiceCounts: Record<string, number> = Object.fromEntries(optionIds.map((id) => [id, 0]));
  for (const r of counted) {
    for (const id of r.selectedOptionIds) {
      if (id in choiceCounts) choiceCounts[id]!++;
    }
  }
  const answered = counted.filter((r) => r.selectedOptionIds.length > 0).length;
  const correct = counted.filter((r) => r.isCorrect).length;
  const times = counted.map((r) => r.timeSpentSec).filter((t): t is number => t !== null);

  const n = counted.length;
  let discrimination: number | null = null;
  if (n >= MIN_RESPONSES_FOR_SIGNALS) {
    const sorted = [...counted].sort((a, b) => a.studentScore - b.studentScore);
    const k = Math.max(1, Math.round(n * 0.27));
    const rate = (group: readonly QuestionResponse[]) =>
      group.filter((r) => r.isCorrect).length / group.length;
    discrimination = round2(rate(sorted.slice(n - k)) - rate(sorted.slice(0, k)));
  }

  const successRate = n === 0 ? null : correct / n;
  const signals: QuestionSignal[] = [];
  if (n >= MIN_RESPONSES_FOR_SIGNALS && successRate !== null) {
    const correctSet = new Set(correctOptionIds);
    const bestCorrect = Math.max(0, ...correctOptionIds.map((id) => choiceCounts[id] ?? 0));
    const bestWrong = Math.max(
      0,
      ...optionIds.filter((id) => !correctSet.has(id)).map((id) => choiceCounts[id] ?? 0),
    );
    // Un distracteur plus choisi que la bonne réponse, par les meilleurs ou par une large
    // majorité (au moins deux fois plus) : la clé est probablement mal saisie.
    if (
      bestWrong > bestCorrect &&
      (discrimination === null || discrimination < 0.1 || bestWrong >= 2 * bestCorrect)
    ) {
      signals.push("SUSPECT_KEY");
    }
    if (successRate < 0.25) signals.push("TOO_HARD");
    if (successRate > 0.95) signals.push("TOO_EASY");
    if (
      discrimination !== null &&
      discrimination < 0.1 &&
      successRate >= 0.25 &&
      successRate <= 0.95 &&
      !signals.includes("SUSPECT_KEY")
    ) {
      signals.push("LOW_DISCRIMINATION");
    }
  }

  return {
    responses: n,
    answered,
    correct,
    successRate,
    choiceCounts,
    avgTimeSec: times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null,
    discrimination,
    signals,
  };
}

/** Temps passé sur une question, borné à sa durée (le serveur peut clore en retard). */
export function timeSpentSec(
  shownAt: Date | null,
  closedAt: Date | null,
  durationSec: number,
): number | null {
  if (!shownAt || !closedAt) return null;
  const s = Math.round((closedAt.getTime() - shownAt.getTime()) / 1000);
  return Math.max(0, Math.min(s, durationSec));
}

// ─── Banque de questions ────────────────────────────────────────────────────

/** Nombre de réponses à partir duquel la difficulté observée est affichée. */
export const MIN_RESPONSES_FOR_DIFFICULTY = 10;

/**
 * Difficulté constatée sur toutes les copies : ≥ 75 % de réussite = facile,
 * < 40 % = difficile, entre les deux = moyenne. null si trop peu de réponses.
 */
export function observedDifficulty(
  successRate: number | null,
  responses: number,
): "FACILE" | "MOYENNE" | "DIFFICILE" | null {
  if (successRate === null || responses < MIN_RESPONSES_FOR_DIFFICULTY) return null;
  if (successRate >= 0.75) return "FACILE";
  if (successRate < 0.4) return "DIFFICILE";
  return "MOYENNE";
}
