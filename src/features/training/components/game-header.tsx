import { cn } from "@/lib/utils";
import { rankOf, type Badge } from "../gamification";

/** Tableau de bord « jeu » : rang, XP, progression et badges du parcours. */
export function GameHeader({
  xp,
  maxXp,
  solved,
  total,
  badges,
}: {
  xp: number;
  maxXp: number;
  solved: number;
  total: number;
  badges: Badge[];
}) {
  const rank = rankOf(xp);
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="relative overflow-hidden rounded-card bg-[linear-gradient(135deg,#315bef_0%,#6d4bff_100%)] p-5 text-white shadow-soft">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15 text-[34px]">
            {rank.icon}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-[12px] font-bold tracking-wide text-white/70 uppercase">
              Rang
            </span>
            <span className="text-[22px] leading-tight font-extrabold">{rank.title}</span>
            <span className="text-[14px] font-semibold text-white/85">
              {xp} XP · {solved} / {total} exercice{total > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-[12px] font-semibold text-white/80">
            <span>
              {rank.next
                ? `Prochain rang : ${rank.next.icon} ${rank.next.title}`
                : "Rang maximum !"}
            </span>
            {rank.next ? <span>{rank.next.min - xp} XP restants</span> : null}
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-label="Progression vers le rang suivant"
            aria-valuenow={Math.round(rank.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[#ffd76a] transition-[width] duration-700"
              style={{ width: `${Math.round(rank.progress * 100)}%` }}
            />
          </div>
          <span className="text-[12px] text-white/70">
            Parcours : {xp} / {maxXp} XP possibles
          </span>
        </div>
      </div>

      <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">Badges</h2>
          <span className="text-[13px] font-semibold text-muted">
            {earned} / {badges.length}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {badges.map((b) => (
            <li
              key={b.key}
              title={`${b.title} : ${b.description}`}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[12px] border px-1.5 py-2.5 text-center",
                b.earned ? "border-[#f5d27a] bg-[#fff8e6]" : "border-line-soft bg-canvas",
              )}
            >
              <span className={cn("text-[26px] leading-none", !b.earned && "opacity-30 grayscale")}>
                {b.icon}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight font-bold",
                  b.earned ? "text-[#9a6b00]" : "text-faint",
                )}
              >
                {b.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
