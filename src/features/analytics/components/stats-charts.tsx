import { PASS_MARK, type HistogramBin } from "@/domain/statistics";
import { cn } from "@/lib/utils";
import { fmtNote, fmtPct } from "../labels";
import type { SegmentRow } from "../types";

/** Mentions usuelles sur 20, calculées à partir des tranches de 2 points. */
const BANDS = [
  { label: "Insuffisant", hint: "< 10", from: 0, to: 10, color: "bg-danger-fill" },
  { label: "Passable", hint: "10 – 12", from: 10, to: 12, color: "bg-warning-fill" },
  { label: "Assez bien", hint: "12 – 14", from: 12, to: 14, color: "bg-[#7ea3ff]" },
  { label: "Bien", hint: "14 – 16", from: 14, to: 16, color: "bg-primary" },
  { label: "Très bien", hint: "≥ 16", from: 16, to: 21, color: "bg-mint-strong" },
] as const;

/** Réussite / échec (anneau) et répartition par mention. */
export function PassFailBands({
  bins,
  passed,
  failed,
}: {
  bins: HistogramBin[];
  passed: number;
  failed: number;
}) {
  const total = passed + failed;
  const bands = BANDS.map((b) => ({
    ...b,
    count: bins.filter((x) => x.from >= b.from && x.from < b.to).reduce((s, x) => s + x.count, 0),
  }));
  const r = 40;
  const c = 2 * Math.PI * r;
  const rate = total ? passed / total : 0;

  return (
    <figure className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-bold">Réussite et mentions</span>
        <span className="text-xs text-muted">seuil : {PASS_MARK}/20</span>
      </figcaption>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Aucune copie notée.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative size-[120px] shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx={50} cy={50} r={r} fill="none" stroke="#fde2e2" strokeWidth={12} />
              <circle
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke="#18b981"
                strokeWidth={12}
                strokeDasharray={`${c * rate} ${c}`}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-bold tabular-nums">{fmtPct(rate)}</span>
              <span className="text-[11px] text-muted">réussite</span>
            </span>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-3">
            <p className="flex gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-mint-strong" aria-hidden />
                <strong className="tabular-nums">{passed}</strong> réussi{passed > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-danger-fill" aria-hidden />
                <strong className="tabular-nums">{failed}</strong> échoué{failed > 1 ? "s" : ""}
              </span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {bands.map((b) => (
                <li key={b.label} className="grid grid-cols-[128px_1fr_36px] items-center gap-2">
                  <span className="text-[12.5px] whitespace-nowrap">
                    <span className="font-semibold">{b.label}</span>{" "}
                    <span className="text-muted">{b.hint}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                    <span
                      className={cn("block h-full rounded-full", b.color)}
                      style={{ width: `${(b.count / total) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-[12.5px] font-semibold tabular-nums">
                    {b.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Comparaison des groupes : moyenne (barre) et réussite, ligne du seuil à 10. */
export function GroupComparison({ rows }: { rows: SegmentRow[] }) {
  const shown = rows.filter((r) => r.summary.mean !== null);
  return (
    <figure className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-bold">Comparaison des groupes</span>
        <span className="text-xs text-muted">moyenne /20</span>
      </figcaption>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Aucune copie notée.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => {
            const mean = r.summary.mean!;
            return (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(80px,140px)_1fr_auto] items-center gap-3"
              >
                <span className="truncate text-[13px] font-semibold" title={r.label}>
                  {r.label}
                </span>
                <span className="relative h-6 rounded-[6px] bg-canvas">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-[6px] transition-[width] duration-300",
                      mean >= PASS_MARK ? "bg-primary" : "bg-[#7480f5]",
                    )}
                    style={{ width: `${(mean / 20) * 100}%` }}
                  />
                  <span
                    className="absolute inset-y-[-3px] w-0 border-l-2 border-dashed border-muted/60"
                    style={{ left: `${(PASS_MARK / 20) * 100}%` }}
                    aria-hidden
                  />
                </span>
                <span className="w-[112px] text-right text-[12.5px] tabular-nums">
                  <strong className={cn("text-[14px]", mean < PASS_MARK && "text-danger")}>
                    {fmtNote(mean)}
                  </strong>{" "}
                  <span className="text-muted">· {fmtPct(r.summary.passRate)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
