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
  points: number;
  durationSec: number;
  neutralized: boolean;
  analysis: QuestionAnalysis;
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
  questions: CopyQuestion[];
}
