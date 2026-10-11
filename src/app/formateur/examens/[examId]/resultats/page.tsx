import {
  BarChart3,
  CalendarDays,
  Download,
  FileDown,
  FileText,
  Grid3x3,
  Radio,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { buttonVariants } from "@/components/ui/button";
import { syncExamAttempts } from "@/features/attempts/server/engine";
import { getManageableExam } from "@/features/exams/server/service";
import { BonusPanel } from "@/features/results/client/bonus-panel";
import { ReleasePanel } from "@/features/results/client/release-panel";
import { ResultsView } from "@/features/results/client/results-view";
import { StudentsTable } from "@/features/results/client/students-table";
import { filterStudents } from "@/features/results/students-filter";
import { clampPage, parsePageParams } from "@/lib/pagination";
import { getExamResults } from "@/features/results/server/queries";
import { formatWindow } from "@/lib/datetime";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Résultats" };

export default async function ExamResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ q?: string; statut?: string; page?: string; taille?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { examId } = await params;
  if (!z.uuid().safeParse(examId).success) notFound();
  try {
    await getManageableExam(user, examId);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  // Copies abandonnées (navigateur fermé) : notées avant l'affichage.
  await syncExamAttempts(examId);
  const results = await getExamResults(examId);
  if (!results) notFound();
  const { exam, summary } = results;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const filtered = filterStudents(results.students, { q, statut: sp.statut });
  const pg = clampPage(parsePageParams(sp), filtered.length);
  const pageRows = filtered.slice(pg.offset, pg.offset + pg.size);
  // Les exports reprennent les mêmes filtres (toutes les pages, pas seulement la visible).
  const exportQuery = new URLSearchParams(
    Object.entries({ q, statut: sp.statut ?? "" }).filter(([, v]) => v),
  ).toString();
  const { students: _all, ...resultsLight } = results;
  void _all;
  const toDate = (s: string | null) => (s ? new Date(s) : null);

  return (
    <>
      <header className="flex flex-col gap-3">
        <BackLink href={paths.exam(examId)}>{exam.title}</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
              <BarChart3 className="size-6" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-muted">Résultats de l&apos;examen</p>
              <h1 className="flex flex-wrap items-center gap-3 text-[26px] leading-tight font-bold">
                {exam.title} <ExamPhaseBadge phase={exam.phase} />
              </h1>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {formatWindow(toDate(exam.opensAt), toDate(exam.closesAt))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  {summary.enrolled} inscrit{summary.enrolled > 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exam.phase === "OUVERT" ? (
              <Link
                href={paths.examMonitor(examId)}
                className={buttonVariants({ variant: "outline" })}
              >
                <Radio aria-hidden /> Suivi en direct
              </Link>
            ) : null}
            <Link
              href={paths.examAnswerSheets(examId)}
              className={buttonVariants({ variant: "outline" })}
            >
              <FileText aria-hidden /> Feuilles de réponses
            </Link>
            <a
              href={paths.examResultsPdf(examId, exportQuery)}
              className={buttonVariants({ variant: "outline" })}
              download
            >
              <FileDown aria-hidden /> Grille PDF
            </a>
            <a
              href={`${paths.examResultsGrid(examId)}${exportQuery ? `?${exportQuery}` : ""}`}
              className={buttonVariants({ variant: "outline" })}
              download
            >
              <Grid3x3 aria-hidden /> Grille Excel
            </a>
            <a
              href={paths.examResultsExport(examId)}
              className={buttonVariants({ variant: "mint" })}
              download
            >
              <Download aria-hidden /> Export complet
            </a>
          </div>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ReleasePanel exam={exam} />
        <BonusPanel examId={examId} bonusPoints={exam.bonusPoints} />
      </div>
      <ResultsView
        results={resultsLight}
        studentsTable={
          <StudentsTable
            examId={examId}
            rows={pageRows}
            total={filtered.length}
            page={pg.page}
            size={pg.size}
          />
        }
      />
    </>
  );
}
