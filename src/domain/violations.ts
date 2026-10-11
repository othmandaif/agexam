import type { SanctionType, SecurityEventType } from "./enums";
import type { ViolationPolicy } from "./exam-settings";

/**
 * Sorties sanctionnées : quitter le plein écran, ou quitter la fenêtre (autre
 * onglet, autre application, autre écran) pendant au moins MIN_AWAY_MS.
 * Un rechargement ou une coupure réseau sont journalisés, jamais sanctionnés.
 */
const AWAY_EVENTS: ReadonlySet<SecurityEventType> = new Set(["VISIBILITY_HIDDEN", "WINDOW_BLUR"]);

/** En dessous, c'est une notification ou un clic involontaire, pas une sortie. */
export const MIN_AWAY_MS = 2_000;

export function isViolationEvent(type: SecurityEventType, awayMs?: number | null): boolean {
  if (type === "FULLSCREEN_EXIT") return true;
  return AWAY_EVENTS.has(type) && (awayMs ?? 0) >= MIN_AWAY_MS;
}

/**
 * Un Alt+Tab déclenche blur + visibilitychange + sortie du plein écran :
 * les événements proches du dernier incident sont fusionnés dans celui-ci.
 */
export function shouldMergeIntoIncident(
  lastIncidentAt: Date | null,
  eventAt: Date,
  mergeWindowMs: number,
): boolean {
  if (!lastIncidentAt) return false;
  const delta = eventAt.getTime() - lastIncidentAt.getTime();
  return delta >= 0 && delta <= mergeWindowMs;
}

/** Sanction applicable à la n-ième violation (n commence à 1). */
export function sanctionFor(policy: ViolationPolicy, violationNumber: number): SanctionType {
  if (!Number.isInteger(violationNumber) || violationNumber < 1) {
    throw new RangeError("Le numéro de violation commence à 1.");
  }
  const index = Math.min(violationNumber, policy.length) - 1;
  return policy[index] ?? "AUCUNE";
}
