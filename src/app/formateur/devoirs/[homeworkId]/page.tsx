import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Lightbulb,
  Plus,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { currentAcademicYear } from "@/domain/academic-year";
import { listGroups } from "@/features/groups/server/queries";
import {
  DeleteHomeworkButton,
  HomeworkSettingsForm,
} from "@/features/homework/components/homework-forms";
import { PublishBanner } from "@/features/homework/components/publish-banner";
import { getHomeworkForStaff, listHomeworkProgress } from "@/features/homework/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Devoir à distance" };

export default async function HomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeworkId: string }>;
  searchParams: Promise<{ importes?: string }>;
}) {
  const { importes } = await searchParams;
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { homeworkId } = await params;
  if (!z.uuid().safeParse(homeworkId).success) notFound();
  const data = await getHomeworkForStaff(user.establishmentId, homeworkId, viewerOf(user)).catch(
    (e) => {
      if (e instanceof AppError) notFound();
      throw e;
    },
  );
  const { homework, steps } = data;
  const editable = homework.academicYear === currentAcademicYear();
  const [groups, progress] = await Promise.all([
    listGroups(user.establishmentId, homework.academicYear, viewerOf(user)),
    listHomeworkProgress(homeworkId),
  ]);
  const handed = progress.filter((p) => p.submittedAt).length;

  return (
    <>
      <PageHeader
        back={{ href: ROUTES.trainer.homework, label: "Devoirs à distance" }}
        icon={<ClipboardCheck />}
        title={homework.title}
        description={homework.description ?? undefined}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {homework.isPublished ? (
              <Badge tone="success">Publié</Badge>
            ) : (
              <Badge tone="neutral">Brouillon</Badge>
            )}
            {homework.sessionLabel ? <Badge tone="info">{homework.sessionLabel}</Badge> : null}
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden />
              {homework.dueAt ? `Pour le ${formatDateTime(homework.dueAt)}` : "Sans date limite"}
            </span>
          </span>
        }
        actions={
          editable ? (
            <>
              <DeleteHomeworkButton homeworkId={homework.id} title={homework.title} />
              <Link
                href={paths.importHomeworkSteps(homework.id)}
                className={buttonVariants({ variant: "outline" })}
              >
                <Upload aria-hidden /> Importer (modèle)
              </Link>
              <Link
                href={paths.newHomeworkStep(homework.id)}
                className={buttonVariants({ variant: "mint" })}
              >
                <Plus aria-hidden /> Nouvelle étape
              </Link>
            </>
          ) : null
        }
      />

      <PublishBanner
        homeworkId={homework.id}
        isPublished={homework.isPublished}
        stepCount={steps.length}
        groupNames={data.groups.map((g) => g.name)}
        readOnly={!editable}
      />
      {importes ? (
        <p
          role="status"
          className="rounded-xl bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          Étapes importées : sorties attendues figées depuis les corrigés.
        </p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {steps.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardCheck}
                title="Aucune étape"
                description="Découpez le problème : 1. analyser les entrées et sorties, 2. lire les données, 3. calculer, 4. l'algorithme complet. Ajoutez les étapes une à une, ou toutes d'un coup avec « Importer (modèle) »."
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Étapes</CardTitle>
                <CardDescription>
                  Le stagiaire ne passe à l&apos;étape suivante que lorsque tous les tests sont
                  réussis. L&apos;indice animé exécute le corrigé de l&apos;étape pas à pas.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {steps.map((s, i) => (
                  <Link
                    key={s.id}
                    href={paths.homeworkStep(homework.id, s.id)}
                    className="group flex items-center gap-4 border-t border-line-soft px-5 py-3.5 text-ink no-underline hover:bg-canvas"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{s.title}</span>
                      <span className="text-[12.5px] text-muted">
                        {s.testCount} jeu{s.testCount > 1 ? "x" : ""} d&apos;essai
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[13px] text-muted">
                      <CheckCircle2 className="size-4 text-success" aria-hidden />
                      {s.solvedBy} réussi{s.solvedBy > 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5 text-[13px] text-muted">
                      <Lightbulb className="size-4 text-[#d99a00]" aria-hidden />
                      {s.hintViews} indice{s.hintViews > 1 ? "s" : ""}
                    </span>
                    <ChevronRight
                      className="size-4 text-faint group-hover:text-primary"
                      aria-hidden
                    />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Avancement des stagiaires</CardTitle>
              <CardDescription>
                {handed} / {progress.length} rendu{handed > 1 ? "s" : ""}. Les étapes réussies et
                les indices consultés aident à préparer la séance suivante.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {progress.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted">
                  Choisissez des groupes dans les réglages pour suivre leurs stagiaires.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Stagiaire</Th>
                        <Th>Étapes réussies</Th>
                        <Th>Indices consultés</Th>
                        <Th>Dernière activité</Th>
                        <Th>Statut</Th>
                        <Th className="text-right">Rendu</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.map((p) => (
                        <tr key={p.id}>
                          <Td className="font-semibold">{p.fullName}</Td>
                          <Td>
                            <span className="flex items-center gap-2">
                              <span className="tabular-nums">
                                {p.stepsPassed} / {steps.length}
                              </span>
                              <span className="flex gap-0.5" aria-hidden>
                                {steps.map((s, i) => (
                                  <span
                                    key={s.id}
                                    className={
                                      i < p.stepsPassed
                                        ? "size-2 rounded-full bg-success"
                                        : "size-2 rounded-full bg-line"
                                    }
                                  />
                                ))}
                              </span>
                            </span>
                          </Td>
                          <Td>
                            {p.hintViews ? (
                              <span title={`Étapes : ${p.hintSteps.join(", ")}`}>
                                {p.hintViews} (étape{p.hintSteps.length > 1 ? "s" : ""}{" "}
                                {p.hintSteps.join(", ")})
                              </span>
                            ) : (
                              <span className="text-muted">Aucun</span>
                            )}
                          </Td>
                          <Td className="text-muted">
                            {p.lastAt ? formatDateTime(new Date(p.lastAt)) : "—"}
                          </Td>
                          <Td>
                            {p.submittedAt ? (
                              <Badge tone={p.isLate ? "warning" : "success"}>
                                {p.isLate ? "Rendu en retard" : "Rendu"}
                              </Badge>
                            ) : (
                              <Badge tone="neutral">Non rendu</Badge>
                            )}
                          </Td>
                          <Td className="text-right">
                            {p.submittedAt ? (
                              <Link
                                href={paths.homeworkHandin(homework.id, p.id)}
                                className="inline-flex items-center gap-1 text-[13px] font-semibold"
                              >
                                <Eye className="size-4" aria-hidden /> Voir
                              </Link>
                            ) : null}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Réglages</CardTitle>
          </CardHeader>
          <CardContent>
            <HomeworkSettingsForm
              key={`${homework.isPublished}-${homework.updatedAt.toISOString()}`}
              homework={{
                id: homework.id,
                title: homework.title,
                sessionLabel: homework.sessionLabel,
                description: homework.description,
                dueAt: homework.dueAt?.toISOString() ?? null,
                isPublished: homework.isPublished,
              }}
              groups={groups}
              selectedGroupIds={data.groups.map((g) => g.id)}
              readOnly={!editable}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
