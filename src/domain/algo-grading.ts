/**
 * Correction des questions d'algorithme : jeux d'essai (objectif) + relecture
 * automatique du code (note partielle quand le programme est incomplet).
 */
export interface AlgoGrading {
  /** running : correction en cours (startedAt) ; reprise si bloquée plus de 5 min. */
  status: "pending" | "running" | "proposed" | "done" | "failed";
  startedAt?: string;
  testsPassed?: number;
  testsTotal?: number;
  /** Part des points obtenue (0 à 1). */
  ratio?: number;
  /** Appréciation montrée au formateur (et à l'étudiant si les copies sont visibles). */
  comment?: string;
  /** auto : jeux d'essai + relecture ; tests : jeux d'essai seuls ; manual : formateur. */
  source?: "auto" | "tests" | "manual";
  gradedAt?: string;
  /** Détail par critère (barème « professeur »), montré au formateur. */
  criteria?: {
    key: string;
    label: string;
    score: number;
    max: number;
    note: string;
  }[];
  /** relecture : relecture automatique du code ; bareme : barème calculé (relecture indisponible). */
  reviewSource?: "relecture" | "bareme";
  /** Raison de l'indisponibilité de la relecture (pour le formateur). */
  reviewError?: string;
  /** Verdict global de la relecture. */
  verdict?: AlgoVerdict;
  /** Analyse du correcteur (ce que fait l'algorithme, erreurs) : formateur seulement. */
  analysis?: string;
  tries?: number;
}

const round = (x: number, step = 0.01) => Number((Math.round(x / step) * step).toFixed(2));

export const ALGO_VERDICTS = [
  "correct",
  "presque",
  "partiel",
  "insuffisant",
  "hors_sujet",
  "vide",
] as const;
export type AlgoVerdict = (typeof ALGO_VERDICTS)[number];

/** Plafond quand au moins un jeu d'essai échoue : la note pleine exige un algorithme juste. */
export const CAP_WHEN_FAILING = 0.95;

/**
 * Note finale, façon professeur :
 * - note pleine seulement si TOUS les jeux d'essai passent ET que la relecture
 *   juge l'algorithme correct (sans relecture : les jeux d'essai font foi) ;
 * - jeux tous réussis mais démarche jugée fautive (valeurs écrites en dur…) :
 *   la note de la relecture s'applique ;
 * - un jeu échoue : la relecture juge tout l'algorithme, plafonnée à 0,95 ;
 *   les jeux réussis restent un plancher (leur part entière).
 */
export function finalAlgoRatio(
  tests: { passed: number; total: number },
  review: { score: number; verdict?: AlgoVerdict | null } | null,
): number {
  const allPass = tests.total > 0 && tests.passed === tests.total;
  const t = tests.total ? tests.passed / tests.total : 0;
  if (!review || !Number.isFinite(review.score)) return round(allPass ? 1 : t);
  const r = Math.max(0, Math.min(1, review.score));
  if (allPass) {
    // Jeux tous réussis : note pleine, sauf démarche jugée fautive (valeurs en dur…).
    if (review.verdict === "correct" || review.verdict === "presque" || review.verdict == null)
      return 1;
    return round(Math.max(0.5, Math.min(r, 0.95)));
  }
  if (review.verdict === "vide") return 0;
  return round(Math.min(CAP_WHEN_FAILING, Math.max(r, t)));
}

/** Ancienne règle (max des deux), gardée pour le barème de secours. */
export function combineAlgoRatio(testsRatio: number, reviewRatio: number | null): number {
  const t = Math.max(0, Math.min(1, testsRatio));
  if (reviewRatio === null || !Number.isFinite(reviewRatio)) return round(t, 0.01);
  const r = Math.max(0, Math.min(1, reviewRatio));
  return Math.min(1, round(Math.max(t, r)));
}

/** Points accordés (null tant que la correction est en attente). */
export function algoRatio(grading: AlgoGrading | null | undefined): number | null {
  return grading?.status === "done" ? (grading.ratio ?? 0) : null;
}
