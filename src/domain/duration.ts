/** Bornes d'une durée de question. */
export const MIN_QUESTION_DURATION_SEC = 5;
export const MAX_QUESTION_DURATION_SEC = 30 * 60;

/**
 * Lit une durée saisie librement :
 * « 30 », « 30s », « 45 sec », « 1min », « 1 min 30 », « 1m30s », « 1:30 », « 2 minutes », « 1h ».
 * Un nombre seul est compris en secondes. Renvoie null si illisible.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase().replace(",", ".");
  if (!value) return null;

  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value));

  const re =
    /^(?:(\d+(?:\.\d+)?)\s*(?:h|heures?|hours?)\s*)?(?:(\d+(?:\.\d+)?)\s*(?:m|mn|mins?|minutes?)\s*)?(?:(\d+)\s*(?:s|sec|secs|secondes?|seconds?)?)?$/;
  const m = re.exec(value);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return Math.round(total);
}

/** 30 → « 30s », 60 → « 1min », 90 → « 1min30 », 125 → « 2min05 ». */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest === 0 ? `${min}min` : `${min}min${String(rest).padStart(2, "0")}`;
}

/** Durée totale lisible : 3150 → « 52 min 30 s », 3600 → « 1 h ». */
export function formatTotalDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s || parts.length === 0) parts.push(`${s} s`);
  return parts.join(" ");
}

export function isDurationInRange(sec: number): boolean {
  return sec >= MIN_QUESTION_DURATION_SEC && sec <= MAX_QUESTION_DURATION_SEC;
}
