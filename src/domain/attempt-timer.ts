/**
 * Chronomètre côté serveur. Le serveur est la seule référence de temps :
 * le navigateur se contente d'afficher `expiresAt - (Date.now() + offset)`.
 */

export interface QuestionWindow {
  shownAt: Date;
  expiresAt: Date;
}

/**
 * Ouvre la fenêtre de temps d'une question.
 * @param timeMultiplier tiers-temps individuel (ex. 1.33), 1 par défaut.
 */
export function openQuestionWindow(
  shownAt: Date,
  durationSec: number,
  timeMultiplier = 1,
): QuestionWindow {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new RangeError("La durée d'une question doit être positive.");
  }
  if (!Number.isFinite(timeMultiplier) || timeMultiplier < 1) {
    throw new RangeError("Le coefficient de temps doit être supérieur ou égal à 1.");
  }
  const durationMs = Math.round(durationSec * timeMultiplier * 1000);
  return { shownAt, expiresAt: new Date(shownAt.getTime() + durationMs) };
}

export function remainingMs(expiresAt: Date, now: Date): number {
  return Math.max(0, expiresAt.getTime() - now.getTime());
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/** Une réponse est acceptée si elle arrive avant l'expiration + la tolérance réseau. */
export function isAnswerAccepted(expiresAt: Date, receivedAt: Date, toleranceSec: number): boolean {
  return receivedAt.getTime() <= expiresAt.getTime() + toleranceSec * 1000;
}

/** Durée totale de l'examen = somme des durées des questions. */
export function totalDurationSec(durationsSec: readonly number[], timeMultiplier = 1): number {
  const total = durationsSec.reduce((sum, d) => sum + d, 0);
  return Math.round(total * timeMultiplier);
}

/**
 * Décalage horloge client → serveur (méthode type NTP), à appliquer à l'affichage.
 * offset > 0 : l'horloge du client retarde.
 */
export function clockOffsetMs(
  serverTimeMs: number,
  clientSentAtMs: number,
  clientReceivedAtMs: number,
): number {
  const roundTrip = clientReceivedAtMs - clientSentAtMs;
  return Math.round(serverTimeMs + roundTrip / 2 - clientReceivedAtMs);
}
