/**
 * Analyse sur plusieurs examens : regroupements et progression des étudiants.
 * Fonctions pures (testées dans analytics.test.ts).
 */
import { PASS_MARK, summarizeScores, type ScoreSummary } from "./statistics";

/** Copie notée (dernière tentative non annulée d'un étudiant à un examen). */
export interface GradedCopy {
  examId: string;
  /** Date de l'examen (ms) : ouverture, sinon création. */
  examAt: number;
  moduleId: string | null;
  studentId: string;
  /** Groupes de l'étudiant concernés par cet examen. */
  groupIds: readonly string[];
  score: number;
}

/** Regroupe les copies ; une copie peut compter dans plusieurs groupes. */
export function groupCopies(
  copies: readonly GradedCopy[],
  keysOf: (c: GradedCopy) => readonly (string | null)[],
): Map<string, GradedCopy[]> {
  const out = new Map<string, GradedCopy[]>();
  for (const c of copies) {
    for (const key of keysOf(c)) {
      if (key === null) continue;
      const list = out.get(key);
      if (list) list.push(c);
      else out.set(key, [c]);
    }
  }
  return out;
}

export function summarizeCopies(copies: readonly GradedCopy[]): ScoreSummary {
  return summarizeScores(copies.map((c) => c.score));
}

export type ProgressTrend = "IMPROVING" | "STABLE" | "DECLINING";

export interface StudentProgress {
  studentId: string;
  count: number;
  mean: number;
  last: number;
  /** Notes dans l'ordre chronologique. */
  history: { examId: string; examAt: number; score: number }[];
  /** Dernière note − moyenne des précédentes (null avec une seule note). */
  delta: number | null;
  trend: ProgressTrend | null;
  /** À suivre : moyenne sous 10 ou baisse nette. */
  atRisk: boolean;
}

/** Écart (en points sur 20) à partir duquel on parle de progrès ou de baisse. */
export const TREND_THRESHOLD = 3;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function studentProgress(copies: readonly GradedCopy[]): StudentProgress[] {
  const byStudent = groupCopies(copies, (c) => [c.studentId]);
  const out: StudentProgress[] = [];
  for (const [studentId, list] of byStudent) {
    const history = [...list]
      .sort((a, b) => a.examAt - b.examAt)
      .map((c) => ({ examId: c.examId, examAt: c.examAt, score: c.score }));
    const scores = history.map((h) => h.score);
    const mean = round2(scores.reduce((s, x) => s + x, 0) / scores.length);
    const last = scores[scores.length - 1]!;
    let delta: number | null = null;
    let trend: ProgressTrend | null = null;
    if (scores.length >= 2) {
      const previous = scores.slice(0, -1);
      delta = round2(last - previous.reduce((s, x) => s + x, 0) / previous.length);
      trend =
        delta >= TREND_THRESHOLD ? "IMPROVING" : delta <= -TREND_THRESHOLD ? "DECLINING" : "STABLE";
    }
    out.push({
      studentId,
      count: scores.length,
      mean,
      last,
      history,
      delta,
      trend,
      atRisk: mean < PASS_MARK || trend === "DECLINING",
    });
  }
  return out;
}

/** Taux de présence : copies notées / inscrits (null sans inscrit). */
export function participationRate(submitted: number, enrolled: number): number | null {
  return enrolled > 0 ? Math.min(1, submitted / enrolled) : null;
}

/**
 * Début de la période analysée. « annee » : année de formation, du 1er septembre
 * (avant septembre : celui de l'année précédente). null = depuis toujours.
 */
export function periodStart(period: "annee" | "30j" | "90j" | "tout", now: Date): Date | null {
  switch (period) {
    case "30j":
      return new Date(now.getTime() - 30 * 86_400_000);
    case "90j":
      return new Date(now.getTime() - 90 * 86_400_000);
    case "annee": {
      const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      return new Date(Date.UTC(year, 8, 1));
    }
    default:
      return null;
  }
}
