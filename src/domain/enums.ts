/**
 * Valeurs métier partagées entre la base de données (pgEnum), les règles métier
 * et l'interface. Une seule source de vérité : ajouter une valeur ici, puis
 * lancer `npm run db:generate`.
 */

export const USER_ROLES = ["ADMIN", "FORMATEUR", "ETUDIANT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUESTION_TYPES = [
  "QCM_SIMPLE",
  "QCM_MULTIPLE",
  "VRAI_FAUX",
  "TRACE_ALGORITHME",
  "RECHERCHE_ERREUR",
  "COMPLEXITE",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ["FACILE", "MOYENNE", "DIFFICILE"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CODE_LANGUAGES = [
  "PSEUDO_CODE",
  "PYTHON",
  "JAVASCRIPT",
  "SQL",
  "C",
  "JAVA",
  "AUTRE",
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const EXAM_STATUSES = ["BROUILLON", "PLANIFIE", "OUVERT", "FERME", "ARCHIVE"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

/** Chrono : une durée par question, ou une durée unique pour tout l'examen. */
export const TIMER_MODES = ["PAR_QUESTION", "GLOBAL"] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

/** Ce que l'étudiant voit après l'examen. */
export const RESULT_VISIBILITIES = ["AUCUNE", "NOTE", "NOTE_DETAIL", "CORRECTION"] as const;
export type ResultVisibility = (typeof RESULT_VISIBILITIES)[number];

/** Quand l'étudiant le voit. */
export const RESULT_RELEASE_MODES = ["IMMEDIAT", "APRES_FERMETURE", "MANUEL"] as const;
export type ResultReleaseMode = (typeof RESULT_RELEASE_MODES)[number];

export const ATTEMPT_STATUSES = [
  "EN_COURS",
  "SOUMISE",
  "SOUMISE_AUTO",
  "EXPIREE",
  "ANNULEE",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ATTEMPT_QUESTION_STATUSES = [
  "A_VENIR",
  "EN_COURS",
  "REPONDUE",
  "EXPIREE",
  "INVALIDEE",
  "NEUTRALISEE",
] as const;
export type AttemptQuestionStatus = (typeof ATTEMPT_QUESTION_STATUSES)[number];

export const SECURITY_EVENT_TYPES = [
  "FULLSCREEN_EXIT",
  "FULLSCREEN_ENTER",
  "VISIBILITY_HIDDEN",
  "VISIBILITY_VISIBLE",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "PAGE_RELOAD",
  "NETWORK_LOST",
  "NETWORK_RESTORED",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CONTEXT_MENU",
  /** L'examen a été repris sur un autre appareil ou onglet (l'ancien est bloqué). */
  "OTHER_DEVICE",
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export const SANCTION_TYPES = [
  "AUCUNE",
  "AVERTISSEMENT",
  "INVALIDER_QUESTION",
  "PENALITE",
  "SOUMISSION_AUTO",
] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];
