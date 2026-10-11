import { cryptoRandomInt, shuffle, shuffleKeepingFixed, type RandomInt } from "./shuffle";

export interface PlannableQuestion {
  id: string;
  options: { id: string; fixedPosition?: boolean }[];
}

export interface PlannedQuestion {
  examQuestionId: string;
  position: number;
  /** Ordre des options affiché à CET étudiant. */
  optionOrder: string[];
}

/**
 * Ordre propre à une tentative : questions toujours mélangées,
 * réponses mélangées si demandé (les options « fixes » gardent leur place).
 */
export function planAttempt(
  questions: readonly PlannableQuestion[],
  opts: { shuffleAnswers: boolean },
  randomInt: RandomInt = cryptoRandomInt,
): PlannedQuestion[] {
  return shuffle(questions, randomInt).map((q, position) => ({
    examQuestionId: q.id,
    position,
    optionOrder: (opts.shuffleAnswers ? shuffleKeepingFixed(q.options, randomInt) : q.options).map(
      (o) => o.id,
    ),
  }));
}

/**
 * Fin de la question : le temps est coupé à la fermeture de l'examen
 * si celle-ci arrive avant la fin normale de la question.
 */
export function questionDeadline(
  shownAt: Date,
  durationSec: number,
  timeMultiplier: number,
  examClosesAt: Date | null,
): Date {
  const end = new Date(shownAt.getTime() + Math.round(durationSec * timeMultiplier * 1000));
  return examClosesAt && examClosesAt < end ? examClosesAt : end;
}

export type ExpiredOutcome = "REPONDUE" | "EXPIREE" | "NEUTRALISEE";

export interface ExpiredQuestionInput {
  selectedCount: number;
  shownAt: Date;
  expiresAt: Date;
  /** Dernier signe de vie du navigateur (heartbeat, réponse, événement). */
  lastSeenAt: Date | null;
  heartbeatIntervalSec: number;
  neutralizationsUsed: number;
  maxNeutralizations: number;
}

/**
 * Que devient une question dont le temps est écoulé ?
 * - une réponse enregistrée compte (chaque clic est sauvegardé) ;
 * - sans réponse, si le navigateur ne donnait plus signe de vie, c'est une coupure :
 *   la question est neutralisée (dans la limite autorisée), sinon elle est perdue.
 */
export function resolveExpiredQuestion(input: ExpiredQuestionInput): {
  outcome: ExpiredOutcome;
  connectionLost: boolean;
} {
  if (input.selectedCount > 0) return { outcome: "REPONDUE", connectionLost: false };
  const lastSeen = Math.max(input.lastSeenAt?.getTime() ?? 0, input.shownAt.getTime());
  const silenceMs = input.expiresAt.getTime() - lastSeen;
  const connectionLost = silenceMs > input.heartbeatIntervalSec * 2_500;
  if (connectionLost && input.neutralizationsUsed < input.maxNeutralizations) {
    return { outcome: "NEUTRALISEE", connectionLost };
  }
  return { outcome: "EXPIREE", connectionLost };
}

/** Vérifie une sélection envoyée par le navigateur. Renvoie un message d'erreur ou null. */
export function selectionError(
  selected: readonly string[],
  optionIds: readonly string[],
  multiple: boolean,
): string | null {
  if (new Set(selected).size !== selected.length) return "Réponse en double.";
  if (selected.some((id) => !optionIds.includes(id))) return "Réponse inconnue.";
  if (!multiple && selected.length > 1) return "Une seule réponse possible.";
  return null;
}

/** Une question est à réponses multiples si plusieurs options sont correctes. */
export function isMultipleAnswer(options: readonly { isCorrect: boolean }[]): boolean {
  return options.filter((o) => o.isCorrect).length > 1;
}

/** Référence lisible d'un reçu : « A7F3-91C2 ». */
export function formatReceiptCode(bytes: Uint8Array): string {
  const hex = Array.from(bytes.slice(0, 4), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
