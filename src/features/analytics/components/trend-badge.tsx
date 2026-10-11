import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ProgressTrend } from "@/domain/analytics";
import { cn } from "@/lib/utils";
import { fmtNote, TREND_LABELS } from "../labels";

/** Tendance : icône + libellé (jamais la couleur seule). */
export function TrendBadge({
  trend,
  delta,
}: {
  trend: ProgressTrend | null;
  delta: number | null;
}) {
  if (!trend) return <span className="text-xs text-muted">—</span>;
  const Icon =
    trend === "IMPROVING" ? ArrowUpRight : trend === "DECLINING" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] font-bold whitespace-nowrap",
        trend === "IMPROVING" && "text-success",
        trend === "DECLINING" && "text-danger",
        trend === "STABLE" && "text-muted",
      )}
      title="Dernière note comparée à la moyenne des précédentes"
    >
      <Icon className="size-4" aria-hidden />
      {TREND_LABELS[trend]}
      {delta !== null && trend !== "STABLE" ? (
        <span className="font-semibold">
          ({delta > 0 ? "+" : ""}
          {fmtNote(delta)})
        </span>
      ) : null}
    </span>
  );
}
