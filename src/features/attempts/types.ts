import type {
  AttemptQuestionStatus,
  CodeLanguage,
  SanctionType,
  SecurityEventType,
  TimerMode,
} from "@/domain/enums";

/** État d'une case de la barre de progression (aucun contenu de question). */
export type ProgressCell =
  "answered" | "expired" | "invalidated" | "neutralized" | "current" | "upcoming";

/** Question en cours telle qu'envoyée au navigateur : JAMAIS les bonnes réponses. */
export interface ClientQuestion {
  attemptQuestionId: string;
  number: number;
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  options: { id: string; label: string }[];
  /** Cases à cocher (plusieurs réponses possibles). */
  multiple: boolean;
  points: number;
  durationSec: number;
  shownAt: string;
  expiresAt: string;
  selectedOptionIds: string[];
}

/** Correction affichée après chaque question d'un entraînement. */
export interface PracticeFeedback {
  number: number;
  prompt: string;
  status: AttemptQuestionStatus;
  /** Ordre vu par l'étudiant, bonnes réponses comprises (question close). */
  options: { id: string; label: string; isCorrect: boolean }[];
  selectedOptionIds: string[];
  /** null : question neutralisée (ne compte pas). */
  correct: boolean | null;
  explanation: string | null;
}

export interface AttemptClientState {
  attemptId: string;
  examTitle: string;
  finished: boolean;
  /** Examen d'entraînement : pas de surveillance, correction après chaque question. */
  practice: boolean;
  /** Entraînement : correction de la question qui vient de se terminer. */
  feedback: PracticeFeedback | null;
  serverNow: string;
  total: number;
  /** PAR_QUESTION : chrono de la question. GLOBAL : temps restant pour tout l'examen. */
  timerMode: TimerMode;
  progress: ProgressCell[];
  /** Message du formateur à tous les étudiants. */
  message: { text: string; at: string } | null;
  violationCount: number;
  /** Sanction appliquée à la prochaine sortie sur la question en cours. */
  nextSanction: SanctionType;
  /** Sorties déjà comptées sur la question en cours (repart à 0 à chaque question). */
  questionViolations: number;
  settings: {
    blockCopyPaste: boolean;
    heartbeatIntervalSec: number;
    answerToleranceSec: number;
    /** Temps encore récupérable après des coupures réseau. */
    pauseLeftSec: number;
  };
  question: ClientQuestion | null;
  /** Envoyé avec le signal de présence uniquement. */
  help?: HelpItem[];
}

/** Question de l'étudiant au formateur et sa réponse. */
export interface HelpItem {
  id: string;
  message: string;
  answer: string | null;
  at: string;
}

/** Événement navigateur envoyé au serveur. */
export interface ClientSecurityEvent {
  type: SecurityEventType;
  /** Heure du navigateur (indicative). */
  at: string;
  attemptQuestionId?: string | null;
  /** Durée de l'absence (fenêtre quittée / onglet masqué), mesurée au retour. */
  awayMs?: number | null;
}

export interface EventsResponse {
  state: AttemptClientState;
  /** Sanction appliquée par cet envoi (nouvelle violation), sinon null. */
  sanction: { type: SanctionType; violationNumber: number } | null;
}
