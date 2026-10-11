import { BackLink } from "@/components/navigation/back-link";
import { CalendarClock, CircleCheck, Hourglass, Lock } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RefreshAt } from "@/components/ui/refresh-at";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTotalDuration } from "@/domain/duration";
import { PracticeStart } from "@/features/attempts/client/practice-start";
import { PreparationPanel } from "@/features/attempts/client/preparation-panel";
import { getExamForStudent } from "@/features/attempts/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Avant de commencer" };

function Notice({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lock;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-lilac text-primary-strong">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </Card>
  );
}

export default async function ExamPreparationPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const student = await requireTenant("ETUDIANT");
  const { examId } = await params;
  const { code } = await searchParams;
  if (!z.uuid().safeParse(examId).success) notFound();

  const exam = await getExamForStudent(student, examId);
  if (!exam) notFound();

  const header = (
    <div className="flex flex-col gap-2 text-center">
      <BackLink href={ROUTES.student.home} className="self-start">
        Mes examens
      </BackLink>
      <h1 className="font-display text-3xl font-bold">{exam.title}</h1>
      <p className="text-muted">
        {[
          exam.moduleCode && `${exam.moduleCode} · ${exam.moduleName}`,
          `${exam.questionCount} questions`,
          formatTotalDuration(exam.totalDurationSec),
          exam.closesAt && `fermeture ${formatDateTime(exam.closesAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {exam.description ? (
        <p className="mx-auto mt-2 max-w-2xl rounded-xl bg-surface px-5 py-3 text-[15px] whitespace-pre-line text-ink-soft shadow-soft">
          {exam.description}
        </p>
      ) : null}
    </div>
  );

  // Entraînement : démarrage simple, historique des essais.
  if (exam.isPractice) {
    if (exam.phase !== "OUVERT" && !exam.activeAttemptId) {
      return (
        <>
          {header}
          <Notice
            icon={exam.phase === "PLANIFIE" ? CalendarClock : Hourglass}
            title={
              exam.phase === "PLANIFIE"
                ? "L'entraînement n'est pas encore ouvert"
                : "L'entraînement est fermé"
            }
          >
            {exam.phase === "PLANIFIE" ? (
              <p className="text-muted">Ouverture : {formatDateTime(exam.opensAt)}.</p>
            ) : null}
          </Notice>
        </>
      );
    }
    return (
      <>
        {header}
        <PracticeStart
          examId={exam.id}
          questionCount={exam.questionCount}
          minDurationSec={exam.minDurationSec}
          maxDurationSec={exam.maxDurationSec}
          globalDurationSec={exam.timerMode === "GLOBAL" ? exam.globalDurationSec : null}
          resumeAttemptId={exam.activeAttemptId}
          tries={exam.practiceHistory.length}
        />
        {exam.practiceHistory.length > 0 ? (
          <Card className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-6">
            <h2 className="font-display text-lg font-bold">Mes essais</h2>
            <ul className="flex flex-col divide-y divide-line-soft">
              {exam.practiceHistory.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted">
                    Essai {exam.practiceHistory.length - i}
                    {a.submittedAt ? ` · ${formatDateTime(a.submittedAt)}` : ""}
                  </span>
                  <span className="flex items-center gap-4">
                    <strong className="font-display text-base tabular-nums">
                      {a.scoreOutOf20 !== null
                        ? `${String(a.scoreOutOf20).replace(".", ",")}/20`
                        : "—"}
                    </strong>
                    <Link
                      href={`/etudiant/resultats/${a.id}` as Route}
                      className="font-bold no-underline"
                    >
                      Correction →
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </>
    );
  }

  // Une tentative en cours : reprise directe.
  if (exam.activeAttemptId) {
    return (
      <>
        {header}
        <PreparationPanel
          examId={exam.id}
          questionCount={exam.questionCount}
          minDurationSec={exam.minDurationSec}
          maxDurationSec={exam.maxDurationSec}
          globalDurationSec={exam.timerMode === "GLOBAL" ? exam.globalDurationSec : null}
          violationPolicy={exam.violationPolicy}
          resumeAttemptId={exam.activeAttemptId}
          initialCode=""
        />
      </>
    );
  }

  if (exam.attemptsUsed >= exam.maxAttempts) {
    return (
      <>
        {header}
        <Notice icon={CircleCheck} title="Examen déjà passé">
          {exam.lastFinishedAttemptId ? (
            <Link
              href={`/etudiant/resultats/${exam.lastFinishedAttemptId}` as Route}
              className={buttonVariants({ variant: "outline" })}
            >
              Voir mon reçu
            </Link>
          ) : null}
        </Notice>
      </>
    );
  }

  if (exam.phase === "PLANIFIE") {
    return (
      <>
        {header}
        <Notice icon={CalendarClock} title="L'examen n'est pas encore ouvert">
          <p className="text-muted">
            Ouverture : {formatDateTime(exam.opensAt)}. La page s&apos;actualise toute seule à
            l&apos;ouverture.
          </p>
          {exam.opensAt ? <RefreshAt at={exam.opensAt.toISOString()} /> : null}
        </Notice>
      </>
    );
  }

  if (exam.phase !== "OUVERT") {
    return (
      <>
        {header}
        <Notice icon={Hourglass} title="L'examen est fermé" />
      </>
    );
  }

  return (
    <>
      {header}
      <PreparationPanel
        examId={exam.id}
        questionCount={exam.questionCount}
        minDurationSec={exam.minDurationSec}
        maxDurationSec={exam.maxDurationSec}
        globalDurationSec={exam.timerMode === "GLOBAL" ? exam.globalDurationSec : null}
        violationPolicy={exam.violationPolicy}
        resumeAttemptId={null}
        initialCode={(code ?? "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6)}
      />
    </>
  );
}
