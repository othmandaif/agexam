import type { SanctionType, SecurityEventType } from "@/domain/enums";
import type { LiveStatus } from "./types";

export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  NOT_STARTED: "Pas commencé",
  IN_PROGRESS: "En cours",
  OFFLINE: "Hors ligne",
  FINISHED: "Terminé",
  AUTO_SUBMITTED: "Soumis auto.",
};

export const LIVE_STATUS_TONE: Record<
  LiveStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  OFFLINE: "warning",
  FINISHED: "success",
  AUTO_SUBMITTED: "danger",
};

export const SANCTION_LABELS: Record<SanctionType, string> = {
  AUCUNE: "Violation enregistrée",
  AVERTISSEMENT: "Avertissement",
  INVALIDER_QUESTION: "Question invalidée",
  PENALITE: "Pénalité",
  SOUMISSION_AUTO: "Soumission automatique",
};

export const SANCTION_TONE: Record<SanctionType, "neutral" | "warning" | "danger"> = {
  AUCUNE: "neutral",
  AVERTISSEMENT: "warning",
  INVALIDER_QUESTION: "danger",
  PENALITE: "danger",
  SOUMISSION_AUTO: "danger",
};

export const EVENT_LABELS: Record<SecurityEventType, string> = {
  FULLSCREEN_EXIT: "Sortie du plein écran",
  FULLSCREEN_ENTER: "Retour en plein écran",
  VISIBILITY_HIDDEN: "Onglet masqué",
  VISIBILITY_VISIBLE: "Onglet de nouveau visible",
  WINDOW_BLUR: "Fenêtre quittée",
  WINDOW_FOCUS: "Retour sur la fenêtre",
  PAGE_RELOAD: "Page rechargée",
  NETWORK_LOST: "Connexion perdue",
  NETWORK_RESTORED: "Connexion rétablie",
  COPY_ATTEMPT: "Tentative de copie",
  PASTE_ATTEMPT: "Tentative de collage",
  CONTEXT_MENU: "Clic droit",
  OTHER_DEVICE: "Examen repris sur un autre appareil ou onglet",
};

/** Événements « positifs » (retour à la normale), affichés en discret. */
export const CALM_EVENTS = new Set<SecurityEventType>([
  "FULLSCREEN_ENTER",
  "VISIBILITY_VISIBLE",
  "WINDOW_FOCUS",
  "NETWORK_RESTORED",
]);

/** « 12 s », « 3 min », « 1 h 05 » */
export function formatAgo(fromIso: string | null, nowIso: string): string {
  if (!fromIso) return "—";
  const s = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** Temps restant « 0:42 » entre deux instants (≥ 0). */
export function formatRemaining(untilIso: string | null, nowIso: string): string | null {
  if (!untilIso) return null;
  const s = Math.max(0, Math.ceil((Date.parse(untilIso) - Date.parse(nowIso)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
