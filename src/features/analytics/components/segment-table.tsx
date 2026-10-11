import { PASS_MARK } from "@/domain/statistics";
import { cn } from "@/lib/utils";
import { fmtNote, fmtPct } from "../labels";
import type { SegmentRow } from "../types";

/** Tableau par groupe ou par module : présence, moyenne, réussite. */
export function SegmentTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: SegmentRow[];
  empty: string;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
      <h2 className="px-5 pt-4 pb-3 font-display text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line-soft text-left text-xs font-bold tracking-wide text-muted uppercase">
              <th className="px-5 py-2">Nom</th>
              <th className="px-2 py-2 text-right">Examens</th>
              <th className="px-2 py-2 text-right">Présence</th>
              <th className="px-2 py-2 text-right">Moyenne</th>
              <th className="px-5 py-2">Réussite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-soft last:border-0">
                <td className="px-5 py-3">
                  <span className="block font-bold">{r.label}</span>
                  {r.sublabel ? (
                    <span className="block text-xs text-muted">{r.sublabel}</span>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{r.exams}</td>
                <td
                  className={cn(
                    "px-2 py-3 text-right tabular-nums",
                    r.participation !== null && r.participation < 0.8 && "font-bold text-warning",
                  )}
                >
                  {fmtPct(r.participation)}
                </td>
                <td
                  className={cn(
                    "px-2 py-3 text-right font-display text-base font-bold tabular-nums",
                    r.summary.mean !== null && r.summary.mean < PASS_MARK && "text-danger",
                  )}
                >
                  {fmtNote(r.summary.mean)}
                </td>
                <td className="px-5 py-3">
                  {r.summary.passRate === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-20 overflow-hidden rounded-full bg-line-soft"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${r.summary.passRate * 100}%` }}
                        />
                      </span>
                      <span className="tabular-nums">{fmtPct(r.summary.passRate)}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
