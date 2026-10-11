import type { ProgressCell } from "@/features/attempts/types";
import { cn } from "@/lib/utils";

export const CELL_CLASS: Record<ProgressCell, string> = {
  answered: "bg-primary",
  expired: "bg-[#9aa3bd]",
  invalidated: "bg-danger-fill",
  neutralized: "bg-[#c9cfde]",
  current: "bg-mint ring-2 ring-mint-strong ring-offset-2",
  upcoming: "bg-line",
};

export const CELL_LABELS: Record<ProgressCell, string> = {
  answered: "Répondue",
  expired: "Temps écoulé",
  invalidated: "Invalidée",
  neutralized: "Neutralisée",
  current: "En cours",
  upcoming: "À venir",
};

/** Barre de progression compacte (une case par question). */
export function ProgressStrip({
  cells,
  className,
  size = "md",
}: {
  cells: ProgressCell[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden>
      {cells.map((cell, i) => (
        <span
          key={i}
          title={`Q${i + 1} · ${CELL_LABELS[cell]}`}
          className={cn(
            "min-w-1 flex-1 rounded-sm",
            size === "sm" ? "h-1.5" : "h-2",
            CELL_CLASS[cell],
            cell === "current" && "ring-offset-1",
          )}
        />
      ))}
    </div>
  );
}
