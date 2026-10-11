import { AlertTriangle, BarChart3, Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsFilterBar } from "@/features/analytics/components/analytics-filter-bar";
import { SegmentTable } from "@/features/analytics/components/segment-table";
import { GroupComparison, PassFailBands } from "@/features/analytics/components/stats-charts";
import { StudentsProgress } from "@/features/analytics/components/students-progress";
import { TrendChart } from "@/features/analytics/components/trend-chart";
import { fmtNote, fmtPct, fmtShortDate } from "@/features/analytics/labels";
import { parseAnalyticsFilters } from "@/features/analytics/schemas";
import { getAnalytics } from "@/features/analytics/server/queries";
import { ScoreHistogram } from "@/features/results/client/score-charts";
import { clampPage, parsePageParams } from "@/lib/pagination";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Statistiques" };

function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "primary";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-card border px-4 py-3",
        tone === "primary" ? "border-primary bg-primary-wash" : "border-line bg-surface",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "font-display text-[26px] leading-tight font-bold tabular-nums",
          tone === "danger" && "text-danger",
          tone === "primary" && "text-primary-strong",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const sp = await searchParams;
  const data = await getAnalytics(user, {
    ...parseAnalyticsFilters(sp),
    year: await getViewYear(),
  });
  const { summary } = data;
  const graded = data.exams.filter((e) => e.mean !== null);

  // Progression des étudiants : filtrée et paginée ici, seule la page part au navigateur.
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const onlyRisk = one("suivi") ? one("suivi") === "risque" : summary.atRisk > 0;
  const studentPool = onlyRisk ? data.students.filter((s) => s.atRisk) : data.students;
  const pg = clampPage(
    parsePageParams({ page: one("page"), taille: one("taille") }),
    studentPool.length,
  );
  const studentRows = studentPool.slice(pg.offset, pg.offset + pg.size);

  return (
    <>
      <PageHeader
        icon={<BarChart3 aria-hidden />}
        title="Statistiques"
        description={
          user.role === "ADMIN"
            ? "Tous les examens notés de l'établissement (entraînements exclus)."
            : "Vos examens notés (entraînements exclus) : groupes, modules, progression des étudiants."
        }
      />
      <AnalyticsFilterBar filters={data.filters} options={data.options} />

      {summary.exams === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={BarChart3}
            title="Aucun examen sur cette période"
            description="Les statistiques apparaissent dès qu'un examen a eu lieu. Essayez une autre période ou retirez un filtre."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi
              label="Moyenne"
              value={summary.mean === null ? "—" : `${fmtNote(summary.mean)}/20`}
              hint={summary.median === null ? undefined : `médiane ${fmtNote(summary.median)}`}
              tone="primary"
            />
            <Kpi
              label="Réussite"
              value={fmtPct(summary.passRate)}
              hint={`${summary.passed} réussi${summary.passed > 1 ? "s" : ""} · notes ≥ 10`}
            />
            <Kpi
              label="Note max / min"
              value={
                summary.max === null ? "—" : `${fmtNote(summary.max)} / ${fmtNote(summary.min)}`
              }
              hint={summary.stdDev === null ? undefined : `écart-type ${fmtNote(summary.stdDev)}`}
            />
            <Kpi
              label="Participation"
              value={fmtPct(summary.participation)}
              hint={`${summary.count} copies / ${summary.enrolled} inscrits`}
            />
            <Kpi
              label="Examens"
              value={String(summary.exams)}
              hint={`${summary.finishedExams} terminé${summary.finishedExams > 1 ? "s" : ""} · ${summary.students} participant${summary.students > 1 ? "s" : ""}`}
            />
          </div>
          {summary.atRisk || summary.flagged ? (
            <div className="flex flex-wrap gap-3">
              {summary.atRisk ? (
                <a
                  href="#progression"
                  className="inline-flex items-center gap-2 rounded-field bg-danger-bg px-3.5 py-2 text-[13.5px] font-semibold text-danger no-underline transition-colors duration-150 hover:brightness-95"
                >
                  <AlertTriangle className="size-4" aria-hidden />
                  {summary.atRisk} étudiant{summary.atRisk > 1 ? "s" : ""} à suivre
                </a>
              ) : null}
              {summary.flagged ? (
                <span className="inline-flex items-center gap-2 rounded-field bg-warning-bg px-3.5 py-2 text-[13.5px] font-semibold text-warning">
                  <Flag className="size-4" aria-hidden />
                  {summary.flagged} copie{summary.flagged > 1 ? "s" : ""} à revoir
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <ScoreHistogram bins={data.histogram} mean={summary.mean} />
            <PassFailBands bins={data.histogram} passed={summary.passed} failed={summary.failed} />
          </div>

          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Moyenne par examen</h2>
              <span className="text-xs text-muted">survolez un point pour le détail</span>
            </div>
            <TrendChart
              labels={graded.map((e) => fmtShortDate(e.examAt))}
              details={graded.map(
                (e) =>
                  `${e.title}${e.moduleCode ? ` · ${e.moduleCode}` : ""} · ${e.submitted}/${e.enrolled} copies · réussite ${fmtPct(e.passRate)}`,
              )}
              series={[
                {
                  name: "Moyenne",
                  values: graded.map((e) => e.mean),
                  dotClass: "bg-primary",
                  stroke: "#4255ff",
                },
              ]}
            />
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <GroupComparison rows={data.byGroup} />
            <SegmentTable title="Par groupe" rows={data.byGroup} empty="Aucun groupe." />
          </div>
          <SegmentTable title="Par module" rows={data.byModule} empty="Aucun module." />

          <div id="progression" className="scroll-mt-24">
            <StudentsProgress
              rows={studentRows}
              total={studentPool.length}
              atRisk={summary.atRisk}
              allCount={data.students.length}
              onlyRisk={onlyRisk}
              page={pg.page}
              size={pg.size}
            />
          </div>

          <section className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
            <h2 className="px-5 pt-4 pb-1 font-display text-lg font-bold">
              {data.filters.examId ? "Taux de réussite par question" : "Questions les plus ratées"}
            </h2>
            <p className="px-5 pb-3 text-xs text-muted">
              {data.filters.examId
                ? "Toutes les questions de l'examen, de la plus ratée à la mieux réussie."
                : "Sur toutes les copies de la période (10 réponses minimum). Une question reprise dans plusieurs examens est comptée ensemble. Choisissez un examen pour voir chaque question."}
            </p>
            {data.hardQuestions.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Pas encore assez de réponses.</p>
            ) : (
              <ol className="divide-y divide-line-soft border-t border-line-soft">
                {data.hardQuestions.map((q, i) => (
                  <li key={q.questionId}>
                    <Link
                      href={paths.bankQuestion(q.questionId)}
                      className="flex items-center gap-4 px-5 py-3 text-ink no-underline hover:bg-primary-wash"
                    >
                      <span className="w-5 text-right font-bold text-muted tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 font-semibold">{q.prompt}</span>
                        <span className="text-xs text-muted">
                          {q.moduleCode} · {q.responses} réponses · {q.exams} examen
                          {q.exams > 1 ? "s" : ""}
                        </span>
                      </span>
                      <span className="flex w-36 items-center gap-2">
                        <span
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft"
                          aria-hidden
                        >
                          <span
                            className={`block h-full rounded-full ${
                              q.successRate < 0.5
                                ? "bg-danger-fill"
                                : q.successRate < 0.7
                                  ? "bg-warning-fill"
                                  : "bg-mint-strong"
                            }`}
                            style={{ width: `${q.successRate * 100}%` }}
                          />
                        </span>
                        <span className="w-10 text-right text-sm font-bold tabular-nums">
                          {fmtPct(q.successRate)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}
