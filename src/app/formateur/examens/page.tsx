import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IllustrationExam } from "@/components/illustrations";
import { Pagination } from "@/components/ui/pagination";
import { UrlSearch, UrlSelect } from "@/components/ui/url-filters";
import { formatTotalDuration } from "@/domain/duration";
import { examPhase, PHASE_LABELS } from "@/domain/exam-lifecycle";
import { ExamTabs } from "@/features/exams/client/exam-tabs";
import { ExamsTable, type ExamRow } from "@/features/exams/client/exams-table";
import {
  EXAM_TABS,
  getEditorOptions,
  listExamsPage,
  type ExamTab,
} from "@/features/exams/server/queries";
import { listGroupOptions } from "@/features/accounts/server/queries";
import { formatWindow } from "@/lib/datetime";
import { clampPage, parsePageParams } from "@/lib/pagination";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { currentAcademicYear } from "@/domain/academic-year";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Examens" };

const uuid = /^[0-9a-f-]{36}$/i;

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    etat?: string;
    module?: string;
    groupe?: string;
    q?: string;
    page?: string;
    taille?: string;
  }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const sp = await searchParams;
  const tab: ExamTab = (EXAM_TABS as readonly string[]).includes(sp.etat ?? "")
    ? (sp.etat as ExamTab)
    : "TOUS";
  const moduleId = sp.module && uuid.test(sp.module) ? sp.module : null;
  const groupId = sp.groupe && uuid.test(sp.groupe) ? sp.groupe : null;
  const q = (sp.q ?? "").trim().slice(0, 100);
  let pg = parsePageParams(sp);
  const year = await getViewYear();

  const [options, yearGroups, firstPage] = await Promise.all([
    getEditorOptions(user.establishmentId),
    listGroupOptions(user.establishmentId, year),
    listExamsPage(user, { tab, moduleId, groupId, q, year, offset: pg.offset, limit: pg.size }),
  ]);
  // Page hors bornes (après une suppression, un filtre…) : dernière page réelle.
  let { rows, counts, total } = firstPage;
  const clamped = clampPage(pg, total);
  if (clamped.page !== pg.page) {
    pg = clamped;
    ({ rows, counts, total } = await listExamsPage(user, {
      tab,
      year,
      moduleId,
      groupId,
      q,
      offset: pg.offset,
      limit: pg.size,
    }));
  }

  const now = new Date();
  const tableRows: ExamRow[] = rows.map((e) => ({
    id: e.id,
    title: e.title,
    phase: examPhase(e, now),
    isPractice: e.isPractice,
    meta: [e.moduleCode, e.groupNames, user.role === "ADMIN" ? e.authorName : null]
      .filter(Boolean)
      .join(" · "),
    period: formatWindow(e.opensAt, e.closesAt),
    content: `${e.questionCount} question${e.questionCount > 1 ? "s" : ""} · ${formatTotalDuration(e.totalDurationSec)}${
      e.attemptCount > 0 ? ` · ${e.attemptCount} copie${e.attemptCount > 1 ? "s" : ""}` : ""
    }`,
    accessCode: e.accessCode,
    attemptCount: e.attemptCount,
  }));
  const filtered = !!(moduleId || groupId || q);
  const nothingAtAll = counts.TOUS === 0 && counts.ARCHIVE === 0 && !filtered;

  return (
    <>
      <PageHeader
        icon={<FileText aria-hidden />}
        title="Examens"
        description={
          user.role === "ADMIN" ? "Tous les examens de l'établissement." : "Vos examens."
        }
        actions={
          year === currentAcademicYear() ? (
            <Link href={ROUTES.trainer.newExam} className={buttonVariants({ variant: "mint" })}>
              <Plus aria-hidden /> Nouvel examen
            </Link>
          ) : undefined
        }
      />

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        <div className="flex flex-wrap gap-3 border-b border-line-soft p-4">
          <UrlSelect
            param="module"
            label="Module"
            allLabel="Tous les modules"
            options={options.modules.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))}
          />
          <UrlSelect
            param="groupe"
            label="Groupe"
            allLabel="Tous les groupes"
            options={yearGroups.map((g) => ({ value: g.id, label: g.name }))}
          />
          <UrlSearch placeholder="Rechercher un examen…" label="Rechercher un examen" />
        </div>
        <div className="border-b border-line-soft px-4 py-2.5">
          <ExamTabs
            active={tab}
            tabs={EXAM_TABS.map((t) => ({
              id: t,
              label: t === "TOUS" ? "Tous" : t === "ARCHIVE" ? "Archivés" : PHASE_LABELS[t],
              count: counts[t],
            }))}
          />
        </div>

        <ExamsTable
          rows={tableRows}
          empty={
            <EmptyState
              illustration={<IllustrationExam />}
              title={
                nothingAtAll
                  ? "Aucun examen"
                  : filtered
                    ? "Aucun examen ne correspond"
                    : "Aucun examen dans cet état"
              }
              description={
                nothingAtAll
                  ? "Créez un examen : collez vos questions, réglez les durées, publiez."
                  : filtered
                    ? "Modifiez le module, le groupe ou la recherche."
                    : undefined
              }
              action={
                nothingAtAll ? (
                  <Link
                    href={ROUTES.trainer.newExam}
                    className={buttonVariants({ variant: "mint" })}
                  >
                    <Plus aria-hidden /> Créer mon premier examen
                  </Link>
                ) : undefined
              }
            />
          }
        />
        <Pagination total={total} page={pg.page} size={pg.size} noun="examens" />
      </section>
    </>
  );
}
