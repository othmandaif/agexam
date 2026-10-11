import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileText,
  GraduationCap,
  PlayCircle,
  QrCode,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { IllustrationCalendar, IllustrationQuestions } from "@/components/illustrations";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTotalDuration } from "@/domain/duration";
import { examPhase } from "@/domain/exam-lifecycle";
import { PASS_MARK } from "@/domain/statistics";
import { JoinByCodeForm } from "@/features/attempts/components/join-by-code-form";
import { listStudentAttempts } from "@/features/attempts/server/queries";
import { listStudentUpcomingExams } from "@/features/exams/server/queries";
import { formatDateTime, formatWindow } from "@/lib/datetime";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Mes examens" };

const preparationPath = (examId: string) => `/etudiant/examens/${examId}/preparation` as Route;

export default async function StudentHomePage() {
  const user = await requireTenant("ETUDIANT");
  const firstName = user.fullName.split(" ")[0];
  const now = new Date();
  const [upcoming, myAttempts] = await Promise.all([
    listStudentUpcomingExams(user.id, user.establishmentId),
    listStudentAttempts(user),
  ]);
  const exams = upcoming.map((e) => ({ ...e, phase: examPhase(e, now) }));
  const active = myAttempts.filter((a) => a.status === "EN_COURS");
  const finished = myAttempts.filter((a) => a.status !== "EN_COURS");
  // Un vrai examen ouvert passe avant un entraînement.
  const open =
    exams.find((e) => e.phase === "OUVERT" && !e.isPractice) ??
    exams.find((e) => e.phase === "OUVERT");

  return (
    <>
      {/* Bienvenue */}
      <section className="relative flex items-center justify-between gap-6 overflow-hidden rounded-panel border border-line bg-hero px-8 py-7">
        <div className="relative z-10 flex max-w-[620px] flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-[12.5px] font-semibold text-primary">
            <GraduationCap className="size-4" aria-hidden /> Espace étudiant
          </span>
          <h1 className="text-[32px] leading-tight font-bold">Bonjour {firstName}</h1>
          {active.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-[15px] text-muted">
                Examen en cours : <strong className="text-ink">{active[0]!.examTitle}</strong>
              </p>
              <Link
                href={`/examen/${active[0]!.id}` as Route}
                className={buttonVariants({ variant: "primary" })}
              >
                <PlayCircle aria-hidden /> Reprendre
              </Link>
            </div>
          ) : open ? (
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-[15px] text-muted">
                {open.isPractice ? "Entraînement disponible" : "Examen ouvert maintenant"} :{" "}
                <strong className="text-ink">{open.title}</strong>
              </p>
              <Link
                href={preparationPath(open.id)}
                className={buttonVariants({ variant: "primary" })}
              >
                {open.isPractice ? "S'entraîner" : "Rejoindre"} <ChevronRight aria-hidden />
              </Link>
            </div>
          ) : (
            <p className="text-[15px] text-muted">
              Accédez à vos examens avec le code donné en salle et retrouvez vos résultats ici.
            </p>
          )}
        </div>
        <IllustrationQuestions className="h-[130px] w-auto shrink-0 max-md:hidden" />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Code */}
        <Card className="p-6">
          <div className="mb-5 flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
              <QrCode className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-[18px] font-bold">Entrer un code d&apos;examen</h2>
              <p className="text-[14px] text-muted">
                Saisissez le code affiché par votre formateur pour accéder à l&apos;examen.
              </p>
            </div>
          </div>
          <JoinByCodeForm />
        </Card>

        {/* Résultats */}
        <Card className="overflow-hidden">
          <div className="flex items-start gap-4 p-6 pb-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-bg text-[#18b981]">
              <BarChart3 className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-[18px] font-bold">Mes résultats</h2>
              <p className="text-[14px] text-muted">Vos derniers examens et entraînements.</p>
            </div>
          </div>
          {finished.length === 0 ? (
            <p className="mx-6 mb-6 rounded-[12px] bg-canvas px-4 py-5 text-center text-[14px] text-muted">
              Vos notes apparaîtront ici après votre premier examen.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 px-4 pb-4">
              {finished.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/etudiant/resultats/${a.id}` as Route}
                    className="flex items-center gap-3.5 rounded-[12px] border border-line-soft px-4 py-3 text-ink no-underline transition-colors hover:bg-[#f8fafc]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
                      <FileText className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.examTitle}</span>
                      <span className="block text-[12.5px] text-muted">
                        {formatDateTime(a.submittedAt)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-[17px] font-bold tabular-nums">
                        {a.scoreOutOf20 != null
                          ? `${String(a.scoreOutOf20).replace(".", ",")} / 20`
                          : "—"}
                      </span>
                      {a.scoreOutOf20 != null ? (
                        <Badge tone={a.scoreOutOf20 >= PASS_MARK ? "success" : "warning"}>
                          {a.scoreOutOf20 >= PASS_MARK ? "Réussi" : "Non réussi"}
                        </Badge>
                      ) : (
                        <span className="text-[12px] text-muted">Note pas encore publiée</span>
                      )}
                    </span>
                    <ChevronRight className="size-4 text-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* À venir */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-6 pb-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <h2 className="text-[18px] font-bold">À venir</h2>
        </div>
        {exams.length === 0 ? (
          <EmptyState
            illustration={<IllustrationCalendar />}
            title="Rien de prévu"
            description="Les examens de vos groupes apparaîtront ici dès leur publication."
          />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 px-6 pb-6">
            {exams.map((e) => (
              <li
                key={e.id}
                className={
                  e.phase === "OUVERT"
                    ? "flex flex-col gap-3 rounded-card border border-primary bg-primary-wash p-5"
                    : "flex flex-col gap-3 rounded-card border border-line p-5"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex flex-wrap gap-1.5">
                    <ExamPhaseBadge phase={e.phase} />
                    {e.isPractice ? <Badge tone="info">Entraînement</Badge> : null}
                  </span>
                  {e.moduleCode ? (
                    <span className="text-xs font-semibold text-muted">{e.moduleCode}</span>
                  ) : null}
                </div>
                <h3 className="text-[16px] font-bold">{e.title}</h3>
                <p className="text-[13px] text-muted">{formatWindow(e.opensAt, e.closesAt)}</p>
                <p className="mt-auto border-t border-line-soft pt-3 text-[13px] text-muted">
                  {e.questionCount} questions · {formatTotalDuration(e.totalDurationSec)}
                  {e.authorName ? ` · ${e.authorName}` : ""}
                </p>
                {e.phase === "OUVERT" ? (
                  <Link
                    href={preparationPath(e.id)}
                    className={buttonVariants({ variant: "primary", size: "sm" })}
                  >
                    {e.isPractice ? "S'entraîner" : "Rejoindre"} <ChevronRight aria-hidden />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
