import { CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listStudentHomeworks } from "@/features/homework/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Devoirs à distance" };

export default async function StudentHomeworksPage() {
  const user = await requireTenant("ETUDIANT");
  const list = await listStudentHomeworks(user.id, user.establishmentId);

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-bold">Devoirs des séances à distance</h1>
        <p className="text-[15px] text-muted">
          Avancez étape par étape : l&apos;étape suivante s&apos;ouvre quand tous les tests sont
          réussis. Bloqué ? Ouvrez l&apos;indice animé. À la fin, rendez votre algorithme.
        </p>
      </header>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="Aucun devoir pour l'instant"
            description="Vos formateurs n'ont pas encore publié de devoir pour votre groupe."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((h) => {
            const pct = h.stepCount ? Math.round((h.stepsPassed / h.stepCount) * 100) : 0;
            const overdue = !h.handedIn && h.overdue;
            return (
              <Link
                key={h.id}
                href={paths.studentHomework(h.id)}
                className="group flex flex-col gap-4 rounded-card border border-line bg-surface p-5 text-ink no-underline shadow-soft transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-pop"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
                    {h.handedIn ? (
                      <CheckCircle2 className="size-5 text-success" aria-hidden />
                    ) : (
                      <ClipboardCheck className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
                      {h.title}
                      {h.handedIn ? (
                        <Badge tone="success">Rendu</Badge>
                      ) : (
                        <Badge tone={overdue ? "danger" : "neutral"}>Non rendu</Badge>
                      )}
                    </span>
                    {h.sessionLabel ? (
                      <span className="text-[13px] font-semibold text-primary">
                        {h.sessionLabel}
                      </span>
                    ) : null}
                    <span
                      className={
                        overdue
                          ? "flex items-center gap-1 text-[13px] font-semibold text-danger"
                          : "flex items-center gap-1 text-[13px] text-muted"
                      }
                    >
                      <CalendarClock className="size-3.5" aria-hidden />
                      {h.dueAt
                        ? `À rendre avant le ${formatDateTime(new Date(h.dueAt))}`
                        : "Sans date limite"}
                    </span>
                  </div>
                  <ChevronRight
                    className="size-5 text-faint group-hover:text-primary"
                    aria-hidden
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12.5px] font-semibold text-muted">
                    <span>
                      {h.stepsPassed} / {h.stepCount} étape{h.stepCount > 1 ? "s" : ""}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-canvas"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Avancement"
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
