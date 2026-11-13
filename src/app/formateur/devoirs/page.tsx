import { CalendarClock, ChevronRight, ClipboardCheck, Layers, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { currentAcademicYear } from "@/domain/academic-year";
import { HomeworkCreateForm } from "@/features/homework/components/homework-forms";
import { listHomeworks } from "@/features/homework/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { viewerOf } from "@/server/scope";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Devoirs à distance" };

export default async function HomeworksPage() {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const year = await getViewYear();
  const editable = year === currentAcademicYear();
  const list = await listHomeworks(user.establishmentId, year, viewerOf(user));

  return (
    <>
      <PageHeader
        icon={<ClipboardCheck />}
        title="Devoirs des séances à distance"
        description="Un problème découpé en étapes, guidé pas à pas, avec une date limite. Le stagiaire passe à l'étape suivante quand tous les tests sont réussis et peut ouvrir un indice animé. Aucune note : seulement rendu / non rendu."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          {list.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardCheck}
                title="Aucun devoir"
                description={
                  editable
                    ? "Créez un devoir, ajoutez ses étapes puis publiez-le pour vos groupes."
                    : `Aucun devoir en ${year}.`
                }
              />
            </Card>
          ) : (
            list.map((h) => {
              const overdue = h.overdue;
              return (
                <Link
                  key={h.id}
                  href={paths.homework(h.id)}
                  className="group flex items-center gap-4 rounded-card border border-line bg-surface p-5 text-ink no-underline shadow-soft transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-pop"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
                    <ClipboardCheck className="size-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-bold">{h.title}</span>
                      {h.isPublished ? (
                        <Badge tone="success">Publié</Badge>
                      ) : (
                        <Badge tone="neutral">Brouillon</Badge>
                      )}
                      {h.sessionLabel ? <Badge tone="info">{h.sessionLabel}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <Layers className="size-3.5" aria-hidden />
                        {h.stepCount} étape{h.stepCount > 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5" aria-hidden />
                        {h.groupNames.length ? h.groupNames.join(", ") : "Aucun groupe"}
                      </span>
                      <span className={overdue ? "font-semibold text-danger" : undefined}>
                        <CalendarClock className="mr-1 inline size-3.5" aria-hidden />
                        {h.dueAt
                          ? `Pour le ${formatDateTime(new Date(h.dueAt))}`
                          : "Sans date limite"}
                      </span>
                      <span className="font-semibold text-ink">
                        {h.handinCount} / {h.studentCount} rendu{h.handinCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className="size-5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </Link>
              );
            })
          )}
        </div>
        {editable ? (
          <Card>
            <CardHeader>
              <CardTitle>Nouveau devoir</CardTitle>
              <CardDescription>
                Lié à une séance que vous ne pouvez pas assurer en présentiel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HomeworkCreateForm />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
