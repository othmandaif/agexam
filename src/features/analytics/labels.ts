import type { ProgressTrend } from "@/domain/analytics";

export const TREND_LABELS: Record<ProgressTrend, string> = {
  IMPROVING: "En progrès",
  STABLE: "Stable",
  DECLINING: "En baisse",
};

export const fmtNote = (n: number | null) =>
  n === null ? "—" : String(Math.round(n * 100) / 100).replace(".", ",");

export const fmtPct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Casablanca",
  day: "numeric",
  month: "short",
});
export const fmtShortDate = (iso: string) => shortDate.format(new Date(iso));
