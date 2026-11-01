import { ChevronRight, Crown, Lock, LockOpen, Star } from "lucide-react";
import Link from "next/link";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface DoorLevel {
  level: number;
  unlocked: boolean;
  exercises: {
    id: string;
    title: string;
    solved: boolean;
    tried: boolean;
    firstTry?: boolean;
    xp?: number;
  }[];
}

/**
 * Carte des niveaux façon jeu : cadenas ouvert / fermé, étoiles par niveau,
 * points (XP) par exercice. Réussir un exercice ouvre le niveau suivant.
 */
export function DoorMap({ levels }: { levels: DoorLevel[] }) {
  return (
    <ol className="relative flex flex-col gap-5 before:absolute before:top-6 before:bottom-6 before:left-[27px] before:w-1 before:rounded-full before:bg-line">
      {levels.map((l, i) => {
        const solved = l.exercises.filter((e) => e.solved).length;
        const complete = solved === l.exercises.length && solved > 0;
        return (
          <li key={l.level} className="relative flex gap-4">
            <span
              className={cn(
                "z-10 flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-md ring-4 ring-canvas",
                complete
                  ? "bg-[linear-gradient(135deg,#f5b800,#f08c00)]"
                  : l.unlocked
                    ? "bg-[linear-gradient(135deg,#315bef,#6d4bff)]"
                    : "bg-[#9aa3b2]",
              )}
            >
              {complete ? (
                <Crown className="size-5" aria-hidden />
              ) : l.unlocked ? (
                <LockOpen className="size-5" aria-hidden />
              ) : (
                <Lock className="size-5" aria-hidden />
              )}
              <span className="text-[11px] font-extrabold">NIV {l.level}</span>
            </span>

            <section
              className={cn(
                "min-w-0 flex-1 rounded-card border p-4",
                l.unlocked
                  ? "border-line bg-surface shadow-soft"
                  : "border-dashed border-line bg-canvas",
              )}
            >
              <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-[16px] font-bold">Niveau {l.level}</h2>
                <span
                  className="flex items-center gap-0.5"
                  aria-label={`${solved} sur ${l.exercises.length}`}
                >
                  {l.exercises.map((e) => (
                    <Star
                      key={e.id}
                      className={cn(
                        "size-4",
                        e.solved ? "fill-[#f5b800] text-[#f5b800]" : "text-[#cfd5df]",
                      )}
                      aria-hidden
                    />
                  ))}
                </span>
                <span className="text-[13px] text-muted">
                  {!l.unlocked
                    ? `Verrouillé : réussissez un exercice du niveau ${levels[i - 1]?.level}`
                    : complete
                      ? "Niveau terminé 👑"
                      : solved > 0
                        ? "Niveau suivant débloqué · terminez celui-ci pour la couronne"
                        : "Réussissez un exercice pour débloquer la suite"}
                </span>
              </header>

              {l.unlocked ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {l.exercises.map((e) => (
                    <Link
                      key={e.id}
                      href={paths.studentExercise(e.id)}
                      className={cn(
                        "group flex items-center gap-3 rounded-[12px] border px-3.5 py-3 text-ink no-underline transition-[border-color,box-shadow] hover:shadow-pop",
                        e.solved
                          ? "border-[#f5d27a] bg-[#fffaf0]"
                          : e.tried
                            ? "border-[#fcd9a4] bg-surface"
                            : "border-line bg-surface hover:border-primary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full text-[16px]",
                          e.solved ? "bg-[#ffe8a3]" : e.tried ? "bg-warning-bg" : "bg-lilac",
                        )}
                        aria-hidden
                      >
                        {e.solved ? (e.firstTry ? "🎯" : "⭐") : e.tried ? "⏳" : "▶"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.title}</span>
                        <span className="text-[12px] text-muted">
                          {e.solved ? "Réussi" : e.tried ? "En cours" : "À relever"}
                        </span>
                      </span>
                      {e.xp ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[12px] font-extrabold whitespace-nowrap",
                            e.solved ? "bg-[#ffe8a3] text-[#9a6b00]" : "bg-canvas text-muted",
                          )}
                        >
                          {e.solved ? `+${e.xp}` : `${e.xp}+`} XP
                        </span>
                      ) : null}
                      <ChevronRight
                        className="size-4 text-faint group-hover:text-primary"
                        aria-hidden
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted">
                  🔒 {l.exercises.length} exercice{l.exercises.length > 1 ? "s" : ""} à débloquer
                </p>
              )}
            </section>
          </li>
        );
      })}
    </ol>
  );
}
