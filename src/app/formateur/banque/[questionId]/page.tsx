import { FilePlus2, FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { QuestionCard } from "@/components/exam/question-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/features/bank/components/bank-list";
import { CopyQuestionText } from "@/features/bank/components/copy-question-text";
import { QuestionMetaForm } from "@/features/bank/components/question-meta-form";
import { DIFFICULTY_LABELS } from "@/features/bank/schemas";
import { getBankQuestion } from "@/features/bank/server/queries";
import { getModuleWithChapters } from "@/features/establishment/server/queries";
import { formatDate } from "@/lib/datetime";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Question" };

const STATUS: Record<string, string> = {
  BROUILLON: "Brouillon",
  PLANIFIE: "Planifié",
  OUVERT: "Ouvert",
  FERME: "Fermé",
  ARCHIVE: "Archivé",
};

export default async function BankQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { questionId } = await params;
  if (!z.uuid().safeParse(questionId).success) notFound();
  const q = await getBankQuestion(user, questionId);
  if (!q) notFound();
  const moduleDetail = await getModuleWithChapters(user.establishmentId, q.moduleId);
  const s = q.stats;

  return (
    <>
      <PageHeader
        icon={<FileQuestion aria-hidden />}
        back={{ href: ROUTES.trainer.bank, label: "Banque de questions" }}
        title="Question"
        description={[
          `${q.moduleCode}${moduleDetail ? ` · ${moduleDetail.name}` : ""}`,
          q.chapterName,
          q.authorName ? `par ${q.authorName}` : null,
          `créée le ${formatDate(new Date(q.createdAt))}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <CopyQuestionText question={q} />
            <Link href={paths.newExamFromBank([q.id])} className={buttonVariants({ size: "sm" })}>
              <FilePlus2 aria-hidden /> Utiliser dans un nouvel examen
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <QuestionCard
            question={{
              number: null,
              prompt: q.prompt,
              code: q.code,
              codeLanguage: q.codeLanguage,
              options: q.options,
              type: q.type,
              durationSec: q.suggestedDurationSec,
              points: q.defaultPoints,
              explanation: q.explanation,
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Utilisation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {q.usages.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted">Utilisée dans aucun examen.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-xs font-bold tracking-wide text-muted uppercase">
                      <th className="px-5 py-2.5">Examen</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Version</th>
                      <th className="px-3 py-2.5 text-right">Réponses</th>
                      <th className="px-5 py-2.5 text-right">Réussite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.usages.map((u) => (
                      <tr key={u.examId} className="border-b border-line-soft last:border-0">
                        <td className="px-5 py-3">
                          <Link
                            href={paths.exam(u.examId)}
                            className="font-bold text-ink no-underline hover:underline"
                          >
                            {u.title}
                          </Link>
                          <span className="block text-xs text-muted">
                            {STATUS[u.status] ?? u.status}
                            {u.authorName ? ` · ${u.authorName}` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted">
                          {u.opensAt ? formatDate(new Date(u.opensAt)) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          v{u.version}
                          {u.neutralized ? (
                            <Badge tone="neutral" className="ml-2">
                              Neutralisée
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{u.responses || "—"}</td>
                        <td className="px-5 py-3 text-right font-bold tabular-nums">
                          {u.successRate === null ? "—" : `${Math.round(u.successRate * 100)} %`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {q.versions.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Versions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-2 text-sm">
                  {q.versions.map((v) => (
                    <li key={v.version} className="flex flex-wrap items-baseline gap-2">
                      <strong>v{v.version}</strong>
                      {v.current ? <Badge tone="success">Actuelle</Badge> : null}
                      <span className="text-muted">{formatDate(new Date(v.createdAt))}</span>
                      <span>· bonne réponse : {v.correctLabels.join(", ")}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-muted">
                  Une nouvelle version est créée quand la bonne réponse est corrigée depuis les
                  résultats d&apos;un examen. Les copies déjà notées ne changent que dans cet
                  examen.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
          <Card>
            <CardHeader>
              <CardTitle>Résultats</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {s.successRate === null ? (
                <p className="text-sm text-muted">Pas encore passée par des étudiants.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-4xl font-bold tabular-nums">
                    {Math.round(s.successRate * 100)} %
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${s.successRate * 100}%` }}
                    />
                  </span>
                  <span className="text-sm text-muted">
                    de réussite sur {s.responses} réponse{s.responses > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-field bg-canvas px-3 py-2">
                  <dt className="text-xs font-bold text-muted uppercase">Examens</dt>
                  <dd className="font-display text-lg font-bold">{s.examCount}</dd>
                </div>
                <div className="rounded-field bg-canvas px-3 py-2">
                  <dt className="text-xs font-bold text-muted uppercase">Difficulté</dt>
                  <dd className="pt-1">
                    <DifficultyBadge set={q.difficulty} observed={s.observed} />
                  </dd>
                </div>
              </dl>
              {s.observed === null && s.responses > 0 ? (
                <p className="text-xs text-muted">
                  Difficulté observée affichée à partir de 10 réponses (classée «&nbsp;
                  {DIFFICULTY_LABELS[q.difficulty].toLowerCase()}&nbsp;»).
                </p>
              ) : null}
            </CardContent>
          </Card>
          {q.canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Classement</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionMetaForm
                  questionId={q.id}
                  difficulty={q.difficulty}
                  chapterId={q.chapterId}
                  chapters={moduleDetail?.chapters ?? []}
                  archived={q.archived}
                  observed={s.observed}
                />
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
