/** Fuseau de référence pour l'affichage côté serveur. */
export const APP_TIMEZONE = "Africa/Casablanca";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** « mer. 7 oct., 10:00 » */
export function formatDateTime(date: Date | null | undefined): string {
  return date ? dateTimeFormat.format(date) : "—";
}

export function formatTime(date: Date | null | undefined): string {
  return date ? timeFormat.format(date) : "—";
}

export function formatDate(date: Date | null | undefined): string {
  return date ? dateFormat.format(date) : "—";
}

/** « mer. 7 oct., 10:00 → 12:00 » (ou deux dates complètes si jours différents). */
export function formatWindow(opensAt: Date | null, closesAt: Date | null): string {
  if (!opensAt || !closesAt) return "Dates non définies";
  const sameDay =
    new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE, dateStyle: "short" }).format(
      opensAt,
    ) ===
    new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE, dateStyle: "short" }).format(
      closesAt,
    );
  return sameDay
    ? `${formatDateTime(opensAt)} → ${formatTime(closesAt)}`
    : `${formatDateTime(opensAt)} → ${formatDateTime(closesAt)}`;
}

/**
 * Navigateur : Date ISO → valeur d'un <input type="datetime-local"> (heure locale).
 */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Navigateur : valeur d'un <input type="datetime-local"> → ISO (UTC). */
export function fromLocalInputValue(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
