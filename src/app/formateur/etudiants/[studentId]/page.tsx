import { AlertTriangle, GraduationCap, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ResetPasswordForm } from "@/features/accounts/components/account-forms";
import { PASS_MARK } from "@/domain/statistics";
import { TrendBadge } from "@/features/analytics/components/trend-badge";
import { TrendChart } from "@/features/analytics/components/trend-chart";
import { fmtNote, fmtShortDate } from "@/features/analytics/labels";
import { getStudentReport } from "@/features/analytics/server/queries";
import { RESULT_STATUS_LABELS, RESULT_STATUS_TONE } from "@/features/results/labels";
import type { ResultStatus } from "@/features/results/types";
import { formatDate } from "@/lib/datetime";
import { paths, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Fiche étudiant" };

function Stat({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-line bg-surface px-4 py-3">
      <span className="text-xs font-bold tracking-wide text-muted uppercase">{label}</span>
      <span className="font-display text-[26px] leading-tight font-bold tabular-nums">
        {children}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export default async function StudentReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { studentId } = await params;
  if (!z.uuid().safeParse(studentId).success) notFound();
  const report = await getStudentReport(user, studentId);
  if (!report) notFound();
  const { student, summary } = report;
  const chrono = [...report.exams].reverse();
  const graded = chrono.filter((e) => e.score !== null);

  return (
    <>
      <PageHeader
        icon={<UserRound aria-hidden />}
        back={{ href: ROUTES.trainer.students, label: "Étudiants" }}
        title={student.fullName}
        description={[student.email, student.groups].filter(Boolean).join(" · ")}
        actions={
          summary.atRisk ? (
            <Badge tone="danger">
              <AlertTriangle className="size-3.5" aria-hidden /> À suivre
            </Badge>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Moyenne"
          hint={summary.classMean !== null ? `classe : ${fmtNote(summary.classMean)}` : undefined}
        >
          <span className={cn(summary.mean !== null && summary.mean < PASS_MARK && "text-danger")}>
            {summary.mean === null ? "—" : `${fmtNote(summary.mean)}/20`}
          </span>
        </Stat>
        <Stat
          label="Examens passés"
          hint={`${summary.missed} absence${summary.missed > 1 ? "s" : ""}`}
        >
          {summary.taken}/{summary.taken + summary.missed}
        </Stat>
        <Stat label="Tendance" hint="dernière note / précédentes">
          <span className="text-base">
            <TrendBadge trend={summary.trend} delta={summary.delta} />
          </span>
        </Stat>
        <Stat label="Copies à revoir">{report.exams.filter((e) => e.flagged).length}</Stat>
        <Stat label="Entraînement" hint="essais terminés">
          <span className="inline-flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" aria-hidden />
            {summary.practiceTries}
          </span>
        </Stat>
      </div>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">Notes et moyenne de la classe</h2>
        <TrendChart
          labels={graded.map((e) => fmtShortDate(e.examAt))}
          details={graded.map((e) => `${e.title}${e.rank ? ` · rang ${e.rank}/${e.graded}` : ""}`)}
          series={[
            {
              name: "Étudiant",
              values: graded.map((e) => e.score),
              dotClass: "bg-primary",
              stroke: "#4255ff",
            },
            {
              name: "Moyenne de la classe",
              values: graded.map((e) => e.classMean),
              dotClass: "bg-[#d97706]",
              stroke: "#d97706",
              dashed: true,
            },
          ]}
          emptyText="Aucune copie notée pour cet étudiant."
        />
      </section>

      <section className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
        <h2 className="px-5 pt-4 pb-3 font-display text-lg font-bold">Examens</h2>
        {report.exams.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">
            Aucun examen pour cet étudiant dans votre périmètre.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y border-line-soft text-left text-xs font-bold tracking-wide text-muted uppercase">
                  <th className="px-5 py-2">Examen</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Statut</th>
                  <th className="px-2 py-2 text-right">Note</th>
                  <th className="px-2 py-2 text-right">Classe</th>
                  <th className="px-2 py-2 text-right">Écart</th>
                  <th className="px-2 py-2 text-right">Rang</th>
                  <th className="px-2 py-2 text-center">Sorties</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {report.exams.map((e) => {
                  const gap =
                    e.score !== null && e.classMean !== null ? e.score - e.classMean : null;
                  const status = e.status as ResultStatus;
                  return (
                    <tr key={e.examId} className="border-b border-line-soft last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          href={paths.examResults(e.examId)}
                          className="font-bold text-ink no-underline hover:underline"
                        >
                          {e.title}
                        </Link>
                        {e.moduleCode ? (
                          <span className="block text-xs text-muted">{e.moduleCode}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 text-muted">{formatDate(new Date(e.examAt))}</td>
                      <td className="px-2 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Badge tone={RESULT_STATUS_TONE[status] ?? "neutral"}>
                            {RESULT_STATUS_LABELS[status] ?? e.status}
                          </Badge>
                          {e.flagged ? <Badge tone="danger">À revoir</Badge> : null}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-2 py-3 text-right font-display text-base font-bold tabular-nums",
                          e.score !== null && e.score < PASS_MARK && "text-danger",
                        )}
                      >
                        {fmtNote(e.score)}
                      </td>
                      <td className="px-2 py-3 text-right text-muted tabular-nums">
                        {fmtNote(e.classMean)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-3 text-right font-bold tabular-nums",
                          gap !== null && gap < 0 ? "text-danger" : "text-success",
                        )}
                      >
                        {gap === null ? "—" : `${gap > 0 ? "+" : ""}${fmtNote(gap)}`}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {e.rank ? `${e.rank}/${e.graded}` : "—"}
                      </td>
                      <td className="px-2 py-3 text-center tabular-nums">
                        {e.score !== null ? e.violationCount : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {e.attemptId && e.score !== null ? (
                          <Link
                            href={paths.examCopy(e.examId, e.attemptId)}
                            className="text-[13px] font-bold whitespace-nowrap text-primary no-underline hover:underline"
                          >
                            Copie →
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5">
        <div>
          <h2 className="font-display text-lg font-bold">Accès au compte</h2>
          <p className="text-sm text-muted">
            Mot de passe oublié : générez un mot de passe provisoire à remettre à l&apos;étudiant.
          </p>
        </div>
        <ResetPasswordForm userId={student.id} fullName={student.fullName} email={student.email} />
      </section>
    </>
  );
}
