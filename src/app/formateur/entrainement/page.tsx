import { ChevronRight, Code2, Layers, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { currentAcademicYear } from "@/domain/academic-year";
import { TrackCreateForm } from "@/features/training/components/track-forms";
import { listTracks } from "@/features/training/server/queries";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Entraînement algorithmique" };

export default async function TrainingTracksPage() {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const year = await getViewYear();
  const editable = year === currentAcademicYear();
  const tracks = await listTracks(user.establishmentId, year);

  return (
    <>
      <PageHeader
        icon={<Code2 />}
        title="Entraînement algorithmique"
        description="Parcours d'exercices par niveaux. L'étudiant débloque le niveau suivant dès qu'il réussit un exercice du niveau en cours."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          {tracks.length === 0 ? (
            <Card>
              <EmptyState
                icon={Code2}
                title="Aucun parcours"
                description={
                  editable
                    ? "Créez un premier parcours, ajoutez des exercices puis publiez-le pour vos groupes."
                    : `Aucun parcours en ${year}.`
                }
              />
            </Card>
          ) : (
            tracks.map((t) => (
              <Link
                key={t.id}
                href={paths.track(t.id)}
                className="group flex items-center gap-4 rounded-card border border-line bg-surface p-5 text-ink no-underline shadow-soft transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-pop"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
                  <Code2 className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold">{t.title}</span>
                    {t.isPublished ? (
                      <Badge tone="success">Publié</Badge>
                    ) : (
                      <Badge tone="neutral">Brouillon</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <Layers className="size-3.5" aria-hidden />
                      {t.exerciseCount} exercice{t.exerciseCount > 1 ? "s" : ""} · {t.levelCount}{" "}
                      niveau{t.levelCount > 1 ? "x" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" aria-hidden />
                      {t.groupNames.length ? t.groupNames.join(", ") : "Aucun groupe"}
                    </span>
                    <span>
                      {t.studentCount} étudiant{t.studentCount > 1 ? "s" : ""} actif
                      {t.studentCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className="size-5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </Link>
            ))
          )}
        </div>
        {editable ? (
          <Card>
            <CardHeader>
              <CardTitle>Nouveau parcours</CardTitle>
              <CardDescription>Ex. « Conditions », « Boucles », « Tableaux ».</CardDescription>
            </CardHeader>
            <CardContent>
              <TrackCreateForm />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
