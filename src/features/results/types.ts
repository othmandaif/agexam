import type { AlgoGrading } from "@/domain/algo-grading";
import type {
  AttemptQuestionStatus,
  AttemptStatus,
  CodeLanguage,
  ExamStatus,
  ResultReleaseMode,
  ResultVisibility,
} from "@/domain/enums";
import type { ExamPhase } from "@/domain/exam-lifecycle";
import type { HistogramBin, QuestionAnalysis, ScoreSummary } from "@/domain/statistics";

export type ResultStatus = AttemptStatus | "ABSENT";

export interface ResultStudent {
  profileId: string;
  fullName: string;
  email: string;
  groups: string;
  attemptId: string | null;
  status: ResultStatus;
  scoreOutOf20: number | null;
  scoreAwarded: number | null;
  scoreMax: number | null;
  correct: number;
  answered: number;
  total: number;
  violationCount: number;
  flagged: boolean;
  startedAt: string | null;
  submittedAt: string | null;
  durationSec: number | null;
  receiptCode: string | null;
  /** Rang dans la classe (copies notées), 1 = meilleure note. */
  rank: number | null;
  /** Questions d'algorithme rendues dont la note n'est pas encore définitive. */
  algoToReview: number;
  /** Copie rendue individuellement à l'étudiant. */
  released: boolean;
}

export interface ResultOption {
  id: string;
  label: string;
  isCorrect: boolean;
  fixedPosition: boolean;
}

export interface ResultQuestion {
  examQuestionId: string;
  /** Numéro dans l'ordre de référence de l'examen (1…n). */
  number: number;
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  options: ResultOption[];
  multiple: boolean;
  /** Question d'algorithme : pas de clé à corriger, réussite fixée par la correction. */
  isAlgo: boolean;
  points: number;
  durationSec: number;
  neutralized: boolean;
  analysis: QuestionAnalysis;
  /** Algorithme : code rendu et correction de chaque copie. */
  algoCopies?: AlgoCopyAnswer[];
  /** Type de réponse libre : algorithme ou texte rédigé. */
  algoKind?: "algo" | "texte";
}

export interface AlgoCopyAnswer {
  attemptId: string;
  fullName: string;
  code: string;
  pointsAwarded: number | null;
  grading: AlgoGrading | null;
}

export interface ExamResults {
  exam: {
    id: string;
    title: string;
    status: ExamStatus;
    phase: ExamPhase;
    opensAt: string | null;
    closesAt: string | null;
    resultVisibility: ResultVisibility;
    resultReleaseMode: ResultReleaseMode;
    resultsPublishedAt: string | null;
    /** Bonus ajouté à la note sur 20 de toute la classe. */
    bonusPoints: number;
    /** Ce qu'un étudiant ayant rendu sa copie voit maintenant. */
    studentSees: ResultVisibility;
  };
  summary: ScoreSummary & {
    enrolled: number;
    submitted: number;
    inProgress: number;
    absent: number;
    flagged: number;
    /** Durée moyenne des copies rendues (secondes). */
    avgDurationSec: number | null;
    /** Copies avec un algorithme à valider / noter par le formateur. */
    algoToReview: { attemptId: string; fullName: string; count: number }[];
  };
  histogram: HistogramBin[];
  students: ResultStudent[];
  questions: ResultQuestion[];
}

export interface CopyQuestion {
  attemptQuestionId: string;
  /** Position dans la copie de l'étudiant (1…n). */
  number: number;
  /** Numéro dans l'ordre de référence de l'examen. */
  referenceNumber: number;
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  /** Options dans l'ordre vu par l'étudiant. */
  options: ResultOption[];
  multiple: boolean;
  status: AttemptQuestionStatus;
  examNeutralized: boolean;
  selectedOptionIds: string[];
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  points: number;
  durationSec: number;
  timeSpentSec: number | null;
  explanation: string | null;
  /** Question d'algorithme : code rendu, correction, corrigé (vue formateur). */
  algo: {
    kind: "algo" | "texte";
    code: string | null;
    grading: AlgoGrading | null;
    solution: string;
  } | null;
}

export interface StudentCopy {
  examId: string;
  examTitle: string;
  attemptId: string;
  student: { id: string; fullName: string; email: string };
  status: AttemptStatus;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  receiptCode: string | null;
  scoreOutOf20: number | null;
  scoreAwarded: number | null;
  scoreMax: number | null;
  violationCount: number;
  neutralizations: number;
  flagged: boolean;
  /** Copie rendue individuellement à l'étudiant. */
  released: boolean;
  /** Réponses libres (algorithme / rédaction) dont la note reste à valider. */
  toValidate: number;
  questions: CopyQuestion[];
}
