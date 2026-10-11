import type { ProgressTrend } from "@/domain/analytics";
import type { HistogramBin, ScoreSummary } from "@/domain/statistics";

export type AnalyticsPeriod = "annee" | "30j" | "90j" | "tout";

export interface AnalyticsFilters {
  moduleId: string | null;
  groupId: string | null;
  examId: string | null;
  period: AnalyticsPeriod;
  /** Année scolaire (fixée par le sélecteur ; absente : toutes). */
  year?: string;
}

export interface ExamPoint {
  examId: string;
  title: string;
  examAt: string;
  moduleCode: string | null;
  enrolled: number;
  submitted: number;
  mean: number | null;
  passRate: number | null;
}

export interface SegmentRow {
  id: string;
  label: string;
  sublabel: string | null;
  exams: number;
  copies: number;
  /** Présence : copies notées / inscrits, sur les examens du segment. */
  participation: number | null;
  summary: ScoreSummary;
}

export interface StudentRow {
  studentId: string;
  fullName: string;
  groups: string;
  count: number;
  /** null : aucune copie notée (absent à tous les examens). */
  mean: number | null;
  last: number | null;
  delta: number | null;
  trend: ProgressTrend | null;
  atRisk: boolean;
  /** Notes chronologiques (mini-courbe). */
  history: number[];
  /** Examens du périmètre sans copie notée. */
  missed: number;
  flagged: number;
}

export interface HardQuestion {
  questionId: string;
  prompt: string;
  moduleCode: string;
  responses: number;
  successRate: number;
  exams: number;
}

export interface AnalyticsData {
  filters: AnalyticsFilters;
  options: {
    modules: { id: string; code: string; name: string }[];
    groups: { id: string; name: string }[];
    exams: { id: string; title: string; moduleCode: string | null }[];
  };
  summary: ScoreSummary & {
    exams: number;
    /** Examens dont la fenêtre est fermée. */
    finishedExams: number;
    /** Inscriptions (examen × étudiant) sur le périmètre. */
    enrolled: number;
    passed: number;
    failed: number;
    students: number;
    participation: number | null;
    flagged: number;
    atRisk: number;
  };
  exams: ExamPoint[];
  byGroup: SegmentRow[];
  byModule: SegmentRow[];
  students: StudentRow[];
  hardQuestions: HardQuestion[];
  /** Répartition des notes (tranches de 2 points), calculée côté serveur. */
  histogram: HistogramBin[];
}

export interface StudentReportExam {
  examId: string;
  attemptId: string | null;
  title: string;
  examAt: string;
  moduleCode: string | null;
  status: string;
  score: number | null;
  classMean: number | null;
  rank: number | null;
  graded: number;
  violationCount: number;
  flagged: boolean;
}

export interface StudentReport {
  student: { id: string; fullName: string; email: string; groups: string };
  exams: StudentReportExam[];
  summary: {
    taken: number;
    missed: number;
    mean: number | null;
    classMean: number | null;
    delta: number | null;
    trend: ProgressTrend | null;
    atRisk: boolean;
    practiceTries: number;
  };
}
