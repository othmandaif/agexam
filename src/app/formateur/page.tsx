import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarCheck2,
  ChevronRight,
  Database,
  FileText,
  Lightbulb,
  Plus,
  Radio,
  Rocket,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { IllustrationDashboard, IllustrationExam } from "@/components/illustrations";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatTotalDuration } from "@/domain/duration";
import { examPhase } from "@/domain/exam-lifecycle";
import { fmtNote, fmtPct } from "@/features/analytics/labels";
import { parseAnalyticsFilters } from "@/features/analytics/schemas";
import { getAnalytics } from "@/features/analytics/server/queries";
import { countBankQuestions } from "@/features/bank/server/queries";
import { listExams } from "@/features/exams/server/queries";
import { listGroups } from "@/features/groups/server/queries";
import { formatWindow } from "@/lib/datetime";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Tableau de bord" };

const QUICK = [
  {
    href: ROUTES.trainer.exams,
    icon: FileText,
    tone: "bg-lilac text-primary",
    title: "Gérer mes examens",
    text: "Voir, modifier ou dupliquer vos examens",
  },
  {
    href: ROUTES.trainer.bank,
    icon: Database,
    tone: "bg-success-bg text-[#18b981]",
    title: "Banque de questions",
    text: "Retrouver et réutiliser vos questions",
  },
  {
    href: ROUTES.trainer.groups,
    icon: Users,
    tone: "bg-violet-bg text-violet",
    title: "Gérer mes groupes",
    text: "Créer et organiser vos groupes d'apprenants",
  },
] as const;

export default async function TrainerDashboardPage() {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const year = await getViewYear();
  const now = new Date();
  const [examRows, analytics, groups, questionCount] = await Promise.all([
    listExams(user, year),
    getAnalytics(user, { ...parseAnalyticsFilters({}), year }),
    listGroups(user.establishmentId, year),
    countBankQuestions(user),
  ]);
  const exams = examRows.map((e) => ({ ...e, phase: examPhase(e, now) }));
  const live = exams.filter((e) => e.phase === "OUVERT");
  const upcoming = exams
    .filter((e) => e.phase === "PLANIFIE")
    .sort((a, b) => (a.opensAt?.getTime() ?? 0) - (b.opensAt?.getTime() ?? 0));
  const finished = exams.filter((e) => e.phase === "FERME" || e.phase === "ARCHIVE");
  const drafts = exams.filter((e) => e.phase === "BROUILLON");
  const toFollow = analytics.students.filter((s) => s.atRisk);

  return (
    <>
      {/* En-tête */}
      <section className="relative flex items-center justify-between gap-6 overflow-hidden">
        <div className="flex flex-col gap-1.5">
          <p className="text-[17px] font-semibold text-primary">Bonjour,</p>
          <h1 className="text-[34px] leading-tight font-bold text-ink">{user.fullName}</h1>
          <p className="text-[15px] text-muted">Voici un aperçu de votre activité sur AGExam.</p>
        </div>
        <IllustrationDashboard className="h-[150px] w-auto shrink-0 max-md:hidden" />
      </section>

      {/* Chiffres clés */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FileText />}
          value={upcoming.length + live.length}
          label="Examens planifiés"
          href={`${ROUTES.trainer.exams}?etat=PLANIFIE` as Route}
        />
        <StatCard
          icon={<CalendarCheck2 />}
          value={finished.length}
          label="Examens terminés"
          tone="green"
          href={ROUTES.trainer.stats}
        />
        <StatCard
          icon={<Users />}
          value={groups.length}
          label="Groupes"
          tone="violet"
          href={ROUTES.trainer.groups}
        />
        <StatCard
          icon={<Database />}
          value={questionCount}
          label="Questions dans la banque"
          tone="orange"
          href={ROUTES.trainer.bank}
        />
      </div>

      {/* Examens en cours */}
      {live.map((e) => (
        <section
          key={e.id}
          className="flex flex-wrap items-center gap-6 rounded-card border border-[#cfdafe] bg-primary-wash px-6 py-5"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
            <Radio className="size-6" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
            <div className="flex items-center gap-2">
              <ExamPhaseBadge phase={e.phase} />
              <span className="text-sm text-muted">{formatWindow(e.opensAt, e.closesAt)}</span>
            </div>
            <h2 className="truncate text-lg font-bold">{e.title}</h2>
          </div>
          <div className="flex gap-8 text-center">
            <div>
              <div className="font-mono text-xl font-bold tracking-widest text-ink">
                {e.accessCode}
              </div>
              <div className="text-xs text-muted">code</div>
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums">{e.attemptCount}</div>
              <div className="text-xs text-muted">copies</div>
            </div>
          </div>
          <Link href={paths.examMonitor(e.id)} className={buttonVariants({ variant: "primary" })}>
            Suivi en direct <ArrowRight aria-hidden />
          </Link>
        </section>
      ))}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Prochains examens */}
          <Card className="overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-4">
              <h2 className="flex items-center gap-2.5 text-[18px] font-bold">
                <CalendarDays className="size-5 text-ink" aria-hidden /> Prochains examens
              </h2>
              <Link
                href={ROUTES.trainer.exams}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary no-underline hover:underline"
              >
                Voir tous les examens <ArrowRight className="size-4" aria-hidden />
              </Link>
            </header>
            {upcoming.length === 0 ? (
              <EmptyState
                illustration={<IllustrationExam />}
                title="Aucun examen planifié"
                description="Créez votre premier examen pour commencer à évaluer vos apprenants."
                action={
                  <Link
                    href={ROUTES.trainer.newExam}
                    className={buttonVariants({ variant: "primary" })}
                  >
                    <Plus aria-hidden /> Nouvel examen
                  </Link>
                }
              />
            ) : (
              <ul className="border-t border-line-soft">
                {upcoming.slice(0, 6).map((e) => (
                  <li key={e.id} className="border-b border-line-soft last:border-0">
                    <Link
                      href={paths.exam(e.id)}
                      className="flex flex-wrap items-center gap-4 px-6 py-4 text-ink no-underline transition-colors hover:bg-[#f8fafc]"
                    >
                      <span className="flex size-10 items-center justify-center rounded-[10px] bg-lilac text-primary">
                        <FileText className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.title}</span>
                        <span className="block text-[13px] text-muted">
                          {formatWindow(e.opensAt, e.closesAt)} · {e.groupNames ?? "aucun groupe"}
                        </span>
                      </span>
                      <span className="text-[13px] text-muted">
                        {e.questionCount} questions · {formatTotalDuration(e.totalDurationSec)}
                      </span>
                      <ChevronRight className="size-4 text-faint" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Étudiants à suivre */}
          {analytics.summary.exams > 0 ? (
            <Card className="overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
                <h2 className="flex items-center gap-2.5 text-[18px] font-bold">
                  <AlertTriangle className="size-5 text-ink" aria-hidden /> Étudiants à suivre
                </h2>
                <div className="flex items-center gap-5 text-[13px] text-muted">
                  <span>
                    Moyenne <strong className="text-ink">{fmtNote(analytics.summary.mean)}</strong>
                  </span>
                  <span>
                    Présence{" "}
                    <strong className="text-ink">{fmtPct(analytics.summary.participation)}</strong>
                  </span>
                  <Link
                    href={ROUTES.trainer.stats}
                    className="font-semibold text-primary no-underline hover:underline"
                  >
                    Statistiques →
                  </Link>
                </div>
              </header>
              {toFollow.length === 0 ? (
                <p className="border-t border-line-soft px-6 py-5 text-sm text-muted">
                  Aucun étudiant à suivre cette année : tout le monde est au-dessus de 10 et stable.
                </p>
              ) : (
                <ul className="border-t border-line-soft">
                  {toFollow.slice(0, 5).map((s) => (
                    <li key={s.studentId} className="border-b border-line-soft last:border-0">
                      <Link
                        href={paths.studentReport(s.studentId)}
                        className="flex items-center gap-4 px-6 py-3 text-ink no-underline transition-colors hover:bg-[#f8fafc]"
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-danger-bg text-danger">
                          <AlertTriangle className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.fullName}</span>
                          <span className="block text-[13px] text-muted">
                            {s.count === 0
                              ? "Jamais présent"
                              : s.trend === "DECLINING"
                                ? `En baisse (${fmtNote(s.delta)} pts)`
                                : `Moyenne ${fmtNote(s.mean)}/20`}
                            {s.groups ? ` · ${s.groups}` : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-faint" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col gap-6">
          <section className="relative overflow-hidden rounded-card bg-cta p-6 text-white shadow-md">
            <div
              aria-hidden
              className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10"
            />
            <div className="relative flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Zap className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-[18px] font-bold">Créer un examen</h2>
                <p className="mt-1 text-[14px] text-white/80">
                  Collez vos questions, réglez la durée de chacune, choisissez vos groupes.
                </p>
              </div>
            </div>
            <Link
              href={ROUTES.trainer.newExam}
              className="relative mt-5 inline-flex h-11 items-center gap-2 rounded-[12px] bg-white px-5 text-[14px] font-semibold text-primary no-underline transition-colors hover:bg-primary-wash"
            >
              <Plus className="size-[18px]" aria-hidden /> Nouvel examen
            </Link>
          </section>

          <Card className="overflow-hidden">
            <h2 className="flex items-center gap-2.5 px-6 pt-5 pb-3 text-[17px] font-bold">
              <Rocket className="size-5" aria-hidden /> Accès rapide
            </h2>
            <ul className="px-3 pb-3">
              {QUICK.map((q) => (
                <li key={q.href}>
                  <Link
                    href={q.href}
                    className="flex items-center gap-3.5 rounded-[12px] px-3 py-3 text-ink no-underline transition-colors hover:bg-[#f8fafc]"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${q.tone}`}
                    >
                      <q.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{q.title}</span>
                      <span className="block truncate text-[12.5px] text-muted">{q.text}</span>
                    </span>
                    <ChevronRight className="size-4 text-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {drafts.length > 0 ? (
            <Card className="overflow-hidden">
              <h2 className="px-6 pt-5 pb-3 text-[17px] font-bold">Brouillons</h2>
              <ul className="px-3 pb-3">
                {drafts.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <Link
                      href={paths.editExam(e.id)}
                      className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-ink no-underline hover:bg-[#f8fafc]"
                    >
                      <FileText className="size-4 shrink-0 text-faint" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                        {e.title}
                      </span>
                      <span className="text-xs text-muted">{e.questionCount} q.</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex items-center gap-3 rounded-card bg-primary-wash px-5 py-4 text-[14px] text-ink-soft">
            <Lightbulb className="size-6 shrink-0 text-primary" aria-hidden />
            <p>
              L&apos;évaluation est la première étape <strong>du progrès.</strong>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
