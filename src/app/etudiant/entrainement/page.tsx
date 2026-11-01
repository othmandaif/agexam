import { ChevronRight, Code2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listStudentTracks } from "@/features/training/server/queries";
import { rankOf } from "@/features/training/gamification";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Entraînement" };

export default async function StudentTrainingPage() {
  const user = await requireTenant("ETUDIANT");
  const tracks = await listStudentTracks(user.id, user.establishmentId);
  const totalXp = tracks.reduce((s, t) => s + t.xp, 0);
  const rank = rankOf(totalXp);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-bold">Entraînement algorithmique</h1>
          <p className="text-[15px] text-muted">
            Relevez les défis niveau par niveau : chaque exercice réussi rapporte des points et
            débloque la suite.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-card bg-[linear-gradient(135deg,#315bef,#6d4bff)] px-4 py-3 text-white shadow-soft">
          <span className="text-[28px]">{rank.icon}</span>
          <div className="flex flex-col leading-tight">
            <span className="text-[16px] font-extrabold">{rank.title}</span>
            <span className="text-[13px] font-semibold text-white/85">{totalXp} XP au total</span>
          </div>
        </div>
      </header>
      {tracks.length === 0 ? (
        <Card>
          <EmptyState
            icon={Code2}
            title="Aucun parcours pour l'instant"
            description="Vos formateurs n'ont pas encore publié d'exercices pour votre groupe."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tracks.map((t) => {
            const pct = t.exerciseCount ? Math.round((t.solved / t.exerciseCount) * 100) : 0;
            const done = t.exerciseCount > 0 && t.solved === t.exerciseCount;
            return (
              <Link
                key={t.id}
                href={paths.studentTrack(t.id)}
                className="group flex flex-col gap-4 rounded-card border border-line bg-surface p-5 text-ink no-underline shadow-soft transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-pop"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
                    {done ? (
                      <Trophy className="size-5" aria-hidden />
                    ) : (
                      <Code2 className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[16px] font-bold">{t.title}</span>
                    {t.description ? (
                      <span className="line-clamp-2 text-[13.5px] text-muted">{t.description}</span>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="size-5 text-faint group-hover:text-primary"
                    aria-hidden
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12.5px] font-semibold text-muted">
                    <span>
                      {t.solved} / {t.exerciseCount} exercice{t.exerciseCount > 1 ? "s" : ""} ·{" "}
                      {t.levelCount} niveau{t.levelCount > 1 ? "x" : ""}
                    </span>
                    <span>
                      ⭐ {t.xp} XP · {pct}%
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-canvas"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progression"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
