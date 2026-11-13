import { CalendarClock, CheckCircle2, ChevronRight, CircleDot, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/navigation/back-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HandInButton } from "@/features/homework/components/homework-forms";
import { getStudentHomework } from "@/features/homework/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Devoir" };

export default async function StudentHomeworkPage({
  params,
}: {
  params: Promise<{ homeworkId: string }>;
}) {
  const user = await requireTenant("ETUDIANT");
  const { homeworkId } = await params;
  if (!z.uuid().safeParse(homeworkId).success) notFound();
  const { homework, steps, allPassed, late, handedInAt } = await getStudentHomework(
    user.id,
    user.establishmentId,
    homeworkId,
  ).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const current = steps.find((s) => s.unlocked && !s.passed);

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink href={ROUTES.student.homework}>Devoirs à distance</BackLink>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[28px] leading-tight font-bold">{homework.title}</h1>
          {handedInAt ? (
            <Badge tone="success">Rendu</Badge>
          ) : (
            <Badge tone="neutral">Non rendu</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
          {homework.sessionLabel ? (
            <span className="font-semibold text-primary">{homework.sessionLabel}</span>
          ) : null}
          <span
            className={cn(
              "flex items-center gap-1",
              late && !handedInAt && "font-semibold text-danger",
            )}
          >
            <CalendarClock className="size-4" aria-hidden />
            {homework.dueAt
              ? `À rendre avant le ${formatDateTime(homework.dueAt)}`
              : "Sans date limite"}
          </span>
        </div>
        {homework.description ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
            {homework.description}
          </p>
        ) : null}
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((s) => {
          const body = (
            <>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
                  s.passed
                    ? "bg-success text-white"
                    : s.unlocked
                      ? "bg-primary text-white"
                      : "bg-canvas text-faint",
                )}
              >
                {s.passed ? <CheckCircle2 className="size-5" aria-hidden /> : s.index}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">
                  Étape {s.index} · {s.title}
                </span>
                <span className="text-[13px] text-muted">
                  {s.passed
                    ? "Réussie"
                    : s.unlocked
                      ? s.tried
                        ? "En cours : tous les tests doivent passer"
                        : "À faire"
                      : "Verrouillée : réussissez l'étape précédente"}
                </span>
              </div>
              {s.unlocked ? (
                s === current ? (
                  <Badge tone="info">
                    <CircleDot aria-hidden /> Étape en cours
                  </Badge>
                ) : (
                  <ChevronRight className="size-5 text-faint" aria-hidden />
                )
              ) : (
                <Lock className="size-4.5 text-faint" aria-hidden />
              )}
            </>
          );
          return (
            <li key={s.id}>
              {s.unlocked ? (
                <Link
                  href={paths.studentHomeworkStep(s.id)}
                  className={cn(
                    "flex items-center gap-4 rounded-card border bg-surface p-4 text-ink no-underline shadow-soft transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-pop",
                    s === current ? "border-primary/50" : "border-line",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div
                  aria-disabled
                  className="flex items-center gap-4 rounded-card border border-dashed border-line bg-canvas/60 p-4 text-muted"
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[16px] font-bold text-ink">Rendu final</span>
          <span className="text-[14px] text-muted">
            {handedInAt
              ? `Rendu le ${formatDateTime(handedInAt)}. Vous pouvez encore le rendre à nouveau.`
              : "Votre algorithme complet et sa trace seront envoyés à votre formateur."}
          </span>
        </div>
        <HandInButton
          homeworkId={homework.id}
          ready={allPassed}
          handedIn={!!handedInAt}
          late={late}
        />
      </Card>
    </>
  );
}
