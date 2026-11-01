import { CheckCircle2, ChevronRight, Code2, Lock, Plus, Upload } from "lucide-react";
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
import { DeleteTrackButton, TrackSettingsForm } from "@/features/training/components/track-forms";
import { getTrackForStaff, listTrackProgress } from "@/features/training/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Parcours d'entraînement" };

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ trackId: string }>;
  searchParams: Promise<{ importes?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { trackId } = await params;
  const { importes } = await searchParams;
  if (!z.uuid().safeParse(trackId).success) notFound();
  const data = await getTrackForStaff(user.establishmentId, trackId).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const { track, exercises } = data;
  const editable = track.academicYear === currentAcademicYear();
  const [groups, progress] = await Promise.all([
    listGroups(user.establishmentId, track.academicYear, viewerOf(user)),
    listTrackProgress(trackId),
  ]);
  const levels = [...new Set(exercises.map((e) => e.level))];

  return (
    <>
      <PageHeader
        back={{ href: ROUTES.trainer.training, label: "Entraînement algorithmique" }}
        icon={<Code2 />}
        title={track.title}
        description={track.description ?? undefined}
        eyebrow={
          <span className="flex items-center gap-2">
            {track.isPublished ? (
              <Badge tone="success">Publié</Badge>
            ) : (
              <Badge tone="neutral">Brouillon</Badge>
            )}
            Année {track.academicYear}
          </span>
        }
        actions={
          editable ? (
            <>
              <DeleteTrackButton trackId={track.id} title={track.title} />
              <Link
                href={paths.importExercises(track.id)}
                className={buttonVariants({ variant: "outline" })}
              >
                <Upload aria-hidden /> Importer (modèle)
              </Link>
              <Link
                href={paths.newExercise(track.id)}
                className={buttonVariants({ variant: "mint" })}
              >
                <Plus aria-hidden /> Nouvel exercice
              </Link>
            </>
          ) : null
        }
      />

      {importes ? (
        <p
          role="status"
          className="rounded-xl bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          Exercices importés : sorties attendues figées depuis les corrigés.
        </p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {exercises.length === 0 ? (
            <Card>
              <EmptyState
                icon={Code2}
                title="Aucun exercice"
                description="Ajoutez des exercices : énoncé, corrigé et jeux d'essai. Le niveau 1 est ouvert d'office."
              />
            </Card>
          ) : (
            levels.map((level, i) => (
              <section key={level} className="flex flex-col gap-2.5">
                <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[13px] text-white">
                    {level}
                  </span>
                  Niveau {level}
                  <span className="flex items-center gap-1 text-[12.5px] font-normal text-muted">
                    {i === 0 ? (
                      "· ouvert d'office"
                    ) : (
                      <>
                        · <Lock className="size-3" aria-hidden /> s&apos;ouvre après une réussite au
                        niveau {levels[i - 1]}
                      </>
                    )}
                  </span>
                </h2>
                <Card className="overflow-hidden">
                  {exercises
                    .filter((e) => e.level === level)
                    .map((e) => (
                      <Link
                        key={e.id}
                        href={paths.exercise(track.id, e.id)}
                        className="group flex items-center gap-4 border-b border-line-soft px-5 py-3.5 text-ink no-underline last:border-b-0 hover:bg-canvas"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="font-semibold">{e.title}</span>
                          <span className="text-[12.5px] text-muted">
                            {e.testCount} jeu{e.testCount > 1 ? "x" : ""} d&apos;essai
                          </span>
                        </div>
                        <span className="flex items-center gap-1.5 text-[13px] text-muted">
                          <CheckCircle2 className="size-4 text-success" aria-hidden />
                          {e.solvedBy} / {e.triedBy} réussi{e.solvedBy > 1 ? "s" : ""}
                        </span>
                        <ChevronRight
                          className="size-4 text-faint group-hover:text-primary"
                          aria-hidden
                        />
                      </Link>
                    ))}
                </Card>
              </section>
            ))
          )}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Progression des étudiants</CardTitle>
              <CardDescription>Étudiants ayant soumis au moins une fois.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {progress.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted">
                  Aucune soumission pour l&apos;instant.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Étudiant</Th>
                        <Th>Réussis</Th>
                        <Th>Soumissions</Th>
                        <Th>Dernière activité</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.map((p) => (
                        <tr key={p.id}>
                          <Td className="font-semibold">{p.fullName}</Td>
                          <Td>
                            {p.solved} / {exercises.length}
                          </Td>
                          <Td>{p.submissions}</Td>
                          <Td className="text-muted">{formatDateTime(new Date(p.lastAt))}</Td>
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
            <TrackSettingsForm
              track={track}
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
