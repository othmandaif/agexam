import type { CodeLanguage, Difficulty, QuestionType } from "@/domain/enums";

export type BankSort = "recent" | "used" | "hardest" | "easiest";

export interface BankFilters {
  q: string;
  moduleId: string | null;
  chapterId: string | null;
  type: QuestionType | null;
  difficulty: Difficulty | null;
  archived: boolean;
  sort: BankSort;
}

export interface BankStats {
  /** Examens (hors brouillons) qui utilisent la question. */
  examCount: number;
  draftCount: number;
  responses: number;
  correct: number;
  successRate: number | null;
  observed: Difficulty | null;
  lastUsedAt: string | null;
}

export interface BankOption {
  label: string;
  isCorrect: boolean;
  fixedPosition: boolean;
}

/** Ligne de la banque (version actuelle de la question). */
export interface BankQuestion {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  moduleId: string;
  moduleCode: string;
  chapterId: string | null;
  chapterName: string | null;
  authorId: string | null;
  authorName: string | null;
  version: number;
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  options: BankOption[];
  explanation: string | null;
  /** Question d'algorithme (formateur uniquement). */
  algo: {
    kind?: "algo" | "texte";
    solution: string;
    tests: { inputs: string[]; expected: string }[];
  } | null;
  suggestedDurationSec: number;
  defaultPoints: number;
  archived: boolean;
  createdAt: string;
  stats: BankStats;
}

export interface BankListResult {
  items: BankQuestion[];
  total: number;
  /** Plus de résultats que la page n'en montre. */
  truncated: boolean;
}

export interface BankUsage {
  examId: string;
  title: string;
  status: string;
  opensAt: string | null;
  authorName: string | null;
  version: number;
  neutralized: boolean;
  responses: number;
  correct: number;
  successRate: number | null;
}

export interface BankVersion {
  version: number;
  createdAt: string;
  correctLabels: string[];
  current: boolean;
}

export interface BankQuestionDetail extends BankQuestion {
  canEdit: boolean;
  versions: BankVersion[];
  usages: BankUsage[];
}
