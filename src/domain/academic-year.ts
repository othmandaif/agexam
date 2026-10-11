/**
 * Année scolaire « 2026-2027 » : du 1er septembre au 31 août (heure du Maroc).
 * Groupes, examens et comptes étudiants appartiennent à une année ; les années
 * passées restent consultables en lecture seule.
 */
export const ACADEMIC_TIMEZONE = "Africa/Casablanca";
const YEAR_RE = /^(\d{4})-(\d{4})$/;

export function academicYearOf(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ACADEMIC_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const start = month >= 9 ? year : year - 1;
  return `${start}-${start + 1}`;
}

export function currentAcademicYear(now: Date = new Date()): string {
  return academicYearOf(now);
}

export function isAcademicYear(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = YEAR_RE.exec(value);
  return !!m && Number(m[2]) === Number(m[1]) + 1;
}

/** Libellé court : « 2026-2027 ». */
export const academicYearLabel = (year: string) => year.replace("-", "–");
