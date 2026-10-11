import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/back-link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { UrlSearch } from "@/components/ui/url-filters";
import { PASS_MARK } from "@/domain/statistics";
import { PrintButton } from "@/features/attempts/client/print-button";
import { getManageableExam } from "@/features/exams/server/service";
import { fmtScore } from "@/features/results/labels";
import { getExamResults, getStudentCopy } from "@/features/results/server/queries";
import type { CopyQuestion, ResultQuestion, StudentCopy } from "@/features/results/types";
import { clampPage, parsePageParams } from "@/lib/pagination";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Feuilles de réponses" };

const letters = (ids: string[], letterOf: Map<string, string>) =>
  ids
    .map((id) => letterOf.get(id) ?? "?")
    .sort()
    .join(", ") || "—";

type Mark = { text: string; tone: string };

function mark(q: CopyQuestion): Mark {
  if (q.examNeutralized || q.status === "NEUTRALISEE") {
    return { text: "N", tone: "bg-neutral-bg text-neutral" };
  }
  if (q.status === "INVALIDEE") return { text: "X", tone: "bg-danger-bg text-danger" };
  if (q.selectedOptionIds.length === 0) return { text: "–", tone: "bg-canvas text-muted" };
  return q.isCorrect
    ? { text: "✓", tone: "bg-success-bg text-success" }
    : { text: "✗", tone: "bg-danger-bg text-danger" };
}

/** Toutes les feuilles de réponses de la classe, une par étudiant, prêtes à imprimer. */
export default async function AnswerSheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ q?: string; page?: string; taille?: string }>;
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
  const results = await getExamResults(examId);
  if (!results) notFound();

  // Lettres A, B, C… dans l'ordre de référence de l'examen (identiques pour tous).
  const letterOf = new Map<string, string>();
  const refQuestion = new Map<number, ResultQuestion>();
  for (const q of results.questions) {
    refQuestion.set(q.number, q);
    q.options.forEach((o, i) => letterOf.set(o.id, String.fromCharCode(65 + i)));
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);
  const allWithCopy = results.students
    .filter((s) => s.attemptId && s.status !== "EN_COURS")
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
  const withCopy = q
    ? allWithCopy.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.groups.toLowerCase().includes(q),
      )
    : allWithCopy;
  // Seules les copies de la page courante sont chargées (10 par défaut).
  const pg = clampPage(parsePageParams(sp, 10), withCopy.length);
  const pageStudents = withCopy.slice(pg.offset, pg.offset + pg.size);
  const copies: StudentCopy[] = [];
  for (let i = 0; i < pageStudents.length; i += 8) {
    const chunk = await Promise.all(
      pageStudents.slice(i, i + 8).map((s) => getStudentCopy(examId, s.attemptId!)),
    );
    copies.push(...chunk.filter((c): c is StudentCopy => c !== null));
  }
  const groupsOf = new Map(results.students.map((s) => [s.profileId, s.groups]));
  const absent = results.students.filter((s) => s.status === "ABSENT");

  return (
    <>
      <header className="flex flex-col gap-3 print:gap-1">
        <BackLink href={paths.examResults(examId)}>Résultats</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lilac text-primary print:hidden">
              <FileText className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-muted">Feuilles de réponses</p>
              <h1 className="text-[26px] leading-tight font-bold">{results.exam.title}</h1>
              <p className="text-[13.5px] text-muted">
                {allWithCopy.length} copie{allWithCopy.length > 1 ? "s" : ""}
                {absent.length ? ` · ${absent.length} absent${absent.length > 1 ? "s" : ""}` : ""}
                {results.exam.bonusPoints > 0
                  ? ` · bonus de classe +${fmtScore(results.exam.bonusPoints)}`
                  : ""}
              </p>
            </div>
          </div>
          <PrintButton label="Imprimer cette page" />
        </div>
        <p className="text-xs text-muted">
          ✓ juste · ✗ fausse · – sans réponse · X invalidée (sortie du mode examen) · N neutralisée.
          Lettres dans l&apos;ordre de référence de l&apos;examen.
        </p>
        <div className="flex flex-wrap gap-3 print:hidden">
          <UrlSearch placeholder="Rechercher un étudiant…" label="Rechercher un étudiant" />
        </div>
      </header>

      {copies.length === 0 ? (
        <section className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={FileText}
            title={q ? "Aucune copie ne correspond" : "Aucune copie rendue"}
            description={
              q
                ? "Modifiez la recherche."
                : "Les feuilles de réponses apparaîtront dès qu'un étudiant aura terminé."
            }
          />
        </section>
      ) : (
        copies.map((copy) => {
          const passed = copy.scoreOutOf20 !== null && copy.scoreOutOf20 >= PASS_MARK;
          const rows = [...copy.questions].sort((a, b) => a.referenceNumber - b.referenceNumber);
          const correctCount = rows.filter((q) => q.isCorrect).length;
          return (
            <section
              key={copy.attemptId}
              className="flex break-inside-avoid flex-col gap-3 rounded-card border border-line bg-surface p-5 print:break-after-page print:rounded-none print:border-0 print:p-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-3">
                <div>
                  <h2 className="text-[17px] font-bold">{copy.student.fullName}</h2>
                  <p className="text-[12.5px] text-muted">
                    {groupsOf.get(copy.student.id) || copy.student.email}
                    {copy.receiptCode ? ` · reçu ${copy.receiptCode}` : ""}
                    {copy.violationCount > 0
                      ? ` · ${copy.violationCount} sortie${copy.violationCount > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-muted">
                    {correctCount}/{rows.length} justes
                  </span>
                  {copy.scoreOutOf20 !== null ? (
                    <>
                      <span className="text-[22px] font-bold tabular-nums">
                        {fmtScore(copy.scoreOutOf20)}
                        <span className="text-[13px] font-medium text-muted">/20</span>
                      </span>
                      <Badge tone={passed ? "success" : "danger"}>
                        {passed ? "Réussi" : "Échoué"}
                      </Badge>
                    </>
                  ) : (
                    <Badge tone="neutral">Non notée</Badge>
                  )}
                  <a
                    href={paths.examCopyPdf(examId, copy.attemptId)}
                    download
                    aria-label={`Télécharger la copie PDF de ${copy.student.fullName}`}
                    title="Copie PDF"
                    className="flex size-9 items-center justify-center rounded-[10px] border border-line text-muted transition-colors duration-150 hover:border-primary hover:text-primary print:hidden"
                  >
                    <Download className="size-4" aria-hidden />
                  </a>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                      <th className="w-12 py-1.5 pr-2">N°</th>
                      <th className="py-1.5 pr-2">Question</th>
                      <th className="w-24 py-1.5 pr-2 text-center">Réponse</th>
                      <th className="w-24 py-1.5 pr-2 text-center">Attendue</th>
                      <th className="w-14 py-1.5 pr-2 text-center">État</th>
                      <th className="w-16 py-1.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((q) => {
                      const m = mark(q);
                      const ref = refQuestion.get(q.referenceNumber);
                      const expected = (ref?.options ?? q.options)
                        .filter((o) => o.isCorrect)
                        .map((o) => o.id);
                      return (
                        <tr key={q.attemptQuestionId} className="border-t border-line-soft">
                          <td className="py-1.5 pr-2 font-semibold text-muted tabular-nums">
                            Q{q.referenceNumber}
                          </td>
                          <td className="max-w-[420px] truncate py-1.5 pr-2" title={q.prompt}>
                            {q.prompt}
                          </td>
                          <td className="py-1.5 pr-2 text-center font-semibold">
                            {letters(q.selectedOptionIds, letterOf)}
                          </td>
                          <td className="py-1.5 pr-2 text-center text-muted">
                            {letters(expected, letterOf)}
                          </td>
                          <td className="py-1.5 pr-2 text-center">
                            <span
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-bold",
                                m.tone,
                              )}
                            >
                              {m.text}
                            </span>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {q.pointsAwarded === null
                              ? "—"
                              : `${fmtScore(q.pointsAwarded)}/${fmtScore(q.points)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
      {withCopy.length > pg.size || pg.page > 1 ? (
        <div className="overflow-hidden rounded-card border border-line bg-surface print:hidden [&>nav]:border-t-0">
          <Pagination total={withCopy.length} page={pg.page} size={pg.size} noun="copies" />
        </div>
      ) : null}
    </>
  );
}
